import { PrivateKey, G1Element, G2Element, ModuleInstance } from "@chiamine/bls-signatures";
import { Bytes, bigint_from_bytes, bigint_to_bytes } from "clvm";
import { CoinSpend, OriginCoin, SpendBundle } from "@/models/wallet";
import store from "@/store";
import { GetParentPuzzleResponse } from "@/models/api";
import { AGG_SIG_ME_ADDITIONAL_DATA, DEFAULT_HIDDEN_PUZZLE_HASH, GROUP_ORDER } from "../coin/consts";
import { CoinConditions, prefix0x } from "../coin/condition";
import puzzle, { PuzzleDetail } from "../crypto/puzzle";
import { TokenPuzzleDetail } from "../crypto/receive";
import stdBundle from "./stdBundle";
import { ConditionOpcode } from "../coin/opcode";
import catBundle from "./catBundle";

export type GetPuzzleApiCallback = (parentCoinId: string) => Promise<GetParentPuzzleResponse | undefined>;

class Transfer {

  public generateSpendPlan(
    availcoins: SymbolCoins,
    targets: TransferTarget[],
    changeAddress: string,
    fee: bigint
  ): SpendPlan {
    const plan: SpendPlan = {};
    for (const symbol in availcoins) {
      if (!Object.prototype.hasOwnProperty.call(availcoins, symbol)) continue;

      const coins = availcoins[symbol];
      const tgts = targets.filter(_ => _.symbol == symbol);

      const outgoingExtra = (symbol.toLocaleLowerCase() == "xch") ? fee : 0n;
      const outgoingTotal = tgts.reduce((acc, cur) => acc + cur.amount, 0n) + outgoingExtra;
      const incomingCoins = (symbol.toLocaleLowerCase() == "xch")
        ? this.findCoins(coins, outgoingTotal)
        : this.findPossibleSmallest(coins, outgoingTotal);

      const incomingTotal = incomingCoins.reduce((acc, cur) => acc + cur.amount, 0n);

      const change = incomingTotal - outgoingTotal;
      if (change < 0n)
        throw new Error(`not enough balance to transfer ${symbol}, lacking ${outgoingTotal - incomingTotal}`);

      const transferTargets: TransferTarget[] = [];
      transferTargets.push(...tgts);
      if (change > 0)
        transferTargets.push({ symbol, address: changeAddress, amount: change })

      if (incomingCoins.length > 0)
        plan[symbol] = { coins: incomingCoins, targets: transferTargets };
    }

    return plan;
  }

  public async generateSpendBundle(
    plan: SpendPlan,
    puzzles: TokenPuzzleDetail[],
    getPuzzle: GetPuzzleApiCallback | null = null,
  ): Promise<SpendBundle> {
    if (!store.state.app.bls) throw new Error("bls not initialized");
    const BLS = store.state.app.bls;

    const coin_spends: CoinSpend[] = [];

    const puzzleDict: { [key: string]: PuzzleDetail } = Object.assign({}, ...puzzles.flatMap(_ => _.puzzles).map((x) => ({ [prefix0x(x.hash)]: x })));
    const getPuzDetail = (hash: string) => {
      const puz = puzzleDict[hash];
      if (!puz) throw new Error("cannot find puzzle");
      return puz;
    }

    const sigs: G2Element[] = [];

    for (const symbol in plan) {
      if (!Object.prototype.hasOwnProperty.call(plan, symbol)) continue;

      const tp = plan[symbol];
      const css = symbol.toLocaleLowerCase() == "xch"
        ? await stdBundle.generateCoinSpends(tp, puzzles)
        : await catBundle.generateCoinSpends(tp, puzzles, getPuzzle);
      coin_spends.push(...css);

      for (let i = 0; i < css.length; i++) {
        const coin_spend = css[i];
        const puz = getPuzDetail(coin_spend.coin.puzzle_hash);

        const puzzle_reveal = puz.puzzle;

        const synthetic_sk = this.calculate_synthetic_secret_key(BLS, puz.privateKey, DEFAULT_HIDDEN_PUZZLE_HASH.raw());
        const coinname = this.getCoinName(coin_spend.coin);

        const result = await puzzle.calcPuzzleResult(puzzle_reveal, await puzzle.disassemblePuzzle(coin_spend.solution));
        const signature = await this.signSolution(BLS, result, synthetic_sk, coinname);

        sigs.push(signature);
      }
    }

    const agg_sig = BLS.AugSchemeMPL.aggregate(sigs);
    const sig = Bytes.from(agg_sig.serialize()).hex();
    // console.log("coin_spends", coin_spends);

    return {
      aggregated_signature: prefix0x(sig),
      coin_spends
    }
  }

  public getDelegatedPuzzle(conditions: (string | string[])[][]): string {
    return "(q " + conditions
      .map(_ => "(" + _
        .map(_ => (typeof _ === "object" ? ("(" + _.join(" ") + ")") : _))
        .join(" ") + ")")
      .join(" ") + ")";
  }

  public getCoinName(coin: OriginCoin): Bytes {
    const a = bigint_to_bytes(BigInt(coin.amount), { signed: true });
    const pci = Bytes.from(coin.parent_coin_info, "hex");
    const ph = Bytes.from(coin.puzzle_hash, "hex");
    const cont = pci.concat(ph).concat(a);
    const coinname = Bytes.SHA256(cont);
    return coinname;
  }

  private calculate_synthetic_offset(public_key: G1Element, hidden_puzzle_hash: Uint8Array): bigint {
    const blob = Bytes.SHA256(new Uint8Array([...public_key.serialize(), ...hidden_puzzle_hash]));
    let offset = bigint_from_bytes(blob, { signed: true })
    while (offset < 0) offset += GROUP_ORDER;
    offset %= GROUP_ORDER;
    return offset;
  }

  private calculate_synthetic_secret_key(BLS: ModuleInstance, secret_key: PrivateKey, hidden_puzzle_hash: Uint8Array): PrivateKey {
    const secret_exponent = bigint_from_bytes(Bytes.from(secret_key.serialize()), { signed: true });
    const public_key = secret_key.get_g1();
    const synthetic_offset = this.calculate_synthetic_offset(public_key, hidden_puzzle_hash);
    const synthetic_secret_exponent = (secret_exponent + synthetic_offset) % GROUP_ORDER
    const blob = bigint_to_bytes(synthetic_secret_exponent).raw();
    const synthetic_secret_key = BLS.PrivateKey.from_bytes(blob, true)
    return synthetic_secret_key;
  }

  private async signSolution(BLS: ModuleInstance, solution_executed_result: string, synthetic_sk: PrivateKey, coinname: Bytes): Promise<G2Element> {


    const conds = puzzle.parseConditions(solution_executed_result);

    const sigs: G2Element[] = [];
    const synthetic_pk_hex = Bytes.from(synthetic_sk.get_g1().serialize()).hex();

    for (let i = 0; i < conds.length; i++) {
      const cond = conds[i];
      if (cond.code == ConditionOpcode.AGG_SIG_UNSAFE) {
        throw "not implement";
      }
      else if (cond.code == ConditionOpcode.AGG_SIG_ME) {
        if (!cond.args || cond.args.length != 2) throw "wrong args"
        const args = cond.args as Uint8Array[];
        const msg = Uint8Array.from([...args[1], ...coinname.raw(), ...AGG_SIG_ME_ADDITIONAL_DATA.raw()]);
        const pk_hex = Bytes.from(args[0]).hex();
        if (pk_hex != synthetic_pk_hex) throw "wrong args due to pk != synthetic_pk";
        const sig = BLS.AugSchemeMPL.sign(synthetic_sk, msg);
        sigs.push(sig);
      }
    }

    const agg_sig = BLS.AugSchemeMPL.aggregate(sigs);
    return agg_sig;
  }

  private findCoins(coins: OriginCoin[], num: bigint): OriginCoin[] {
    const sortcoins = coins.sort((a, b) => Number(a.amount - b.amount)); // ascending
    const outcoins: OriginCoin[] = [];

    // find smallest coins
    for (let i = 0; i < sortcoins.length; i++) {
      if (num <= 0) break;
      const coin = sortcoins[i];
      outcoins.push(coin);
      num -= coin.amount;
    }

    // remove smallest coins if larger coin already match output
    for (let i = 0; i < outcoins.length; i++) {
      const coin = outcoins[i];
      if (num + coin.amount > 0) {
        break;
      }
      outcoins.splice(i, 1);
      i--;// fix array index change due to splice
      num += coin.amount;
    }

    return outcoins;
  }

  private findPossibleSmallest(coins: OriginCoin[], num: bigint): OriginCoin[] {
    if (num == 0n) return [];

    const sortcoins = coins.sort((a, b) => Number(a.amount - b.amount));
    for (let i = 0; i < sortcoins.length; i++) {
      const coin = sortcoins[i];
      if (coin.amount >= num) return [coin];
    }

    return [];
  }


  public getSolution(targets: TransferTarget[]) {

    const conditions = [];

    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      if (tgt.memos)
        conditions.push(CoinConditions.CREATE_COIN_Extend(tgt.address, tgt.amount, tgt.memos));
      else
        conditions.push(CoinConditions.CREATE_COIN(tgt.address, tgt.amount));
    }

    const delegated_puzzle_solution = this.getDelegatedPuzzle(conditions);
    // const solution_executed_result = delegated_puzzle_solution;
    const solution_reveal = "(() " + delegated_puzzle_solution + " ())";

    return solution_reveal;
  }
}

export type SymbolCoins = {
  [symbol: string]: OriginCoin[]
};

export interface SpendPlan {
  [symbol: string]: TokenSpendPlan;
}

export interface TokenSpendPlan {
  coins: OriginCoin[];
  targets: TransferTarget[];
}

export interface TransferTarget {
  symbol: string;
  address: string;
  amount: bigint;
  memos?: string[];
}

export default new Transfer();
