import { prefix0x } from "@/services/coin/condition";
import puzzle, { PuzzleDetail } from "@/services/crypto/puzzle";
import { getAccountAddressDetails } from "@/services/util/account";
import { getTestAccount } from "@/test/utility";
import coins from "@/services/developer/coins.json";
import { CoinItem } from "@/models/wallet";

interface ExecuteResultObject {
  bundle?: unknown;
  finish: boolean;
}

export async function executeCode(code: string): Promise<ExecuteResultObject> {
  /* eslint-disable no-useless-escape */
  const text = `<script>async function __run() { ${code} }; __run().then(()=>{ex.finish=true;})
    .catch((msg)=>{console.error(msg);ex.finish=true;});<\/script>`;
  /* eslint-enable no-useless-escape */
  const ifr = document.createElement("iframe");
  ifr.setAttribute("frameborder", "0");
  ifr.setAttribute("id", "iframeResult");
  ifr.setAttribute("name", "iframeResult");
  ifr.setAttribute("allowfullscreen", "false");
  document.body.appendChild(ifr);
  const ifrw = ifr.contentWindow;
  if (!ifrw) throw new Error("Cannot find content window");

  // const tokenPuzzles = await getAccountAddressDetails(account, [], tokenInfo(), xchPrefix(), xchSymbol(), undefined, "cat_v1");
  const account = getTestAccount("55c335b84240f5a8c93b963e7ca5b868e0308974e09f751c7e5668964478008f");
  const tokenPuzzles = await getAccountAddressDetails(account, [], {}, "txch", "TXCH", undefined, "cat_v2");
  const puzzleDict: { [key: string]: PuzzleDetail } = Object.assign(
    {},
    ...tokenPuzzles.flatMap((_) => _.puzzles).map((x) => ({ [prefix0x(x.hash)]: x }))
  );
  const getPuzDetail = (hash: string) => {
    const puz = puzzleDict[hash];
    if (!puz) throw new Error("cannot find puzzle: " + hash);
    return puz;
  };

  const ex: ExecuteResultObject = { bundle: undefined, finish: false };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  (ifrw as any).puzzle = puzzle;
  (ifrw as any).getPuzDetail = getPuzDetail;
  (ifrw as any).ex = ex;
  (ifrw as any).prefix0x = prefix0x;
  (ifrw as any).coins = coins
    .flatMap((_) => _.records)
    .map((_) => _.coin as CoinItem)
    .map((_) => ({
      amount: BigInt(_.amount),
      parent_coin_info: _.parentCoinInfo,
      puzzle_hash: _.puzzleHash,
    }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // const ifrw = (ifr.contentWindow) ? ifr.contentWindow
  // : (ifr.contentDocument && ifr.contentDocument.document) ? ifr.contentDocument.document
  //  : ifr.contentDocument;
  ifrw.document.open();
  ifrw.document.write(text);
  ifrw.document.close();

  return await new Promise(resolve => {
    const refresh = function () {
      if (!ex.finish) {
        setTimeout(() => {
          refresh();
        }, 50);
        return;
      }

      resolve(ex);
      document.body.removeChild(ifr);
    };

    refresh();
  });
}