import { GetParentPuzzleResponse } from "@/models/api";
import { getTestAccount } from "../utility";
import { decodeOffer, encodeOffer } from "@/services/offer/encoding";
import { getOfferSummary, OfferEntity, OfferPlan } from "@/services/offer/summary";
import { combineOfferSpendBundle, generateOffer, generateOfferPlan, getReversePlan } from "@/services/offer/bundler";
import { SymbolCoins } from "@/services/transfer/transfer";
import { Instance } from "@/services/util/instance";
import { getAccountAddressDetails } from "@/services/util/account";
import { AccountEntity, PersistentCustomCat } from "@/models/account";
import { prefix0x } from "@/services/coin/condition";
import { NetworkContext } from "@/services/coin/coinUtility";
import { assertSpendbundle } from "@/services/spendbundle/validator";
import { signSpendBundle } from "@/services/spendbundle";

function xchPrefix() { return "xch"; }
function xchSymbol() { return "XCH"; }
function tokenInfo() {
  return {
    BSH: {
      symbol: "BSH",
      decimal: 3,
      unit: "BSH",
      id: "6e1815ee33e943676ee437a42b7d239c0d0826902480e4c3781fee4b327e1b6b",
    },
  };
}
const net: NetworkContext = {
  prefix: "xch",
  symbol: "XCH",
  chainId: "ccd5bb71183532bff220ba46c268991a3ff07eb358e8255a65c30a2dce0e5fbb",
  api: localPuzzleApiCall,
}

beforeAll(async () => {
  await Instance.init();
})

test('Offer Encoding', async () => {
  const offerText = "offer1qqp83w76wzru6cmqvpsxygqqwc7hynr6hum6e0mnf72sn7uvvkpt68eyumkhelprk0adeg42nlelk2mpafrgx923m0l47c8udnalkndly6tx3nlj8kw87vhh5p4vekl6ul7ll0myae24ja0w6azxqnj67rchq77vsy0kw0w4d6k8fvjj7yc4s86alw454adyl0gcyeqhu4fc4c0lt0znmjj7xzq26y0m8mm7n6lesmnlfrj95u0nldhzag2m7yl0fhh7d8f708kwg6hn4h8nlh4clgclva2xuthwndt9n7e8hduamg36278zdl70wdmauhxg0sk7d8zgxc6gy3ks2tyjgcdj82pfvz6rzvk6rqvkmryvxerwqffpm5dz8crzdaqar0grf8knu4ew4ldrz6wpsj6gap0trj63jwt8azy57h6ckrmydaua8dgx2tst4amn0ud8krwtxwgjd5e9nv0zu7d8akufy2matea866ktqhc7hqw44zpzzlev8w2np5m83s754wfc5aa9z645j20lamxwc7smc9acuw7hdtrmwcx7lvazwt722jh4llph6rj5eg0xkugtarwt4cm3hz2rfv8mpggdjznvnlc9s3drnlumgx6jwct4ypp7mle0vp7tymdeun8uexqlpv0me9lm7xgfk0tk4adv3mjft3k8rvta9grwuyep38h0lqj456rjdmwsn05z6mlkdm6hrhkhqaktd0ranetjmvnwe7edhe7la5elaltlg8l8lcgfpj6uwlhxn6254hnn7zhj6cc5v0a88wgm9vt9k85axakerqkplutzddwt8vd0utcs33sl7fs3740z0cj4w8u5rf5m62da4u6av4fr399wkv7ylwlwaf4qhdyd2q479lczgtkssupsxsgxt9xz0tq4ckgrl8my5zw87v3gn36tt6780c05n0m7tukx5dtemj35xelcgxs9p2ypn3mexa8mpxkp6g2fxu2njl46fcyv4jcvdj958vma6ce0suj8p0wdafglydnv9edahwhe4kr5lcrza9etujm6g5t8m4jdtfffrcn080e363wdpfdm8a0ay7vrtl9ftl2pjw4p8lfmdxelwctc8tspul7u7zs8rqqqcc2wacptnhjp";
  const bundle = await decodeOffer(offerText);
  const summary = await getOfferSummary(bundle);

  expect(summary).toMatchSnapshot("summary");
  expect(bundle).toMatchSnapshot("bundle");

  const encoded = await encodeOffer(bundle, 2);
  expect(encoded).toBe(offerText);
});

test('Make Offer 1', async () => {
  const offplan: OfferPlan[] = [
    {
      "id": "",
      "plan": {
        "coins": [
          {
            "amount": 15n,
            "parent_coin_info": "0xd46f5f861aeb19a3ff8c7bbb73aa1797f585332eb846333d5092c7dcc75af204",
            "puzzle_hash": "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96"
          }
        ],
        "targets": [
          {
            "address": "0xbae24162efbd568f89bc7a340798a6118df0189eb9e3f8697bcea27af99f8f79",
            "amount": 9n,
            "symbol": xchSymbol()
          },
          {
            "symbol": xchSymbol(),
            "address": "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96",
            "amount": 6n
          }
        ]
      }
    }
  ];
  const reqs: OfferEntity[] = [
    {
      "id": "0x6e1815ee33e943676ee437a42b7d239c0d0826902480e4c3781fee4b327e1b6b",
      "symbol": "BSH",
      "amount": 11n,
      "target": "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96"
    }
  ];
  const account = getTestAccount("46815978e90da660427161c265b400831ee59f9aae9a40b449fbcd67ca140590");
  const tokenPuzzles = await getAccountAddressDetails(account, [], tokenInfo(), xchPrefix(), xchSymbol(), undefined, "cat_v1");

  const nonce = "71bdf5d923a48956a8d26a36c6ea4a9959de221ff2ee986bce4827e5f037ceb8";
  const ubundle = await generateOffer(offplan, reqs, tokenPuzzles, net, nonce, "cat_v1");
  const bundle = await signSpendBundle(ubundle, tokenPuzzles, net.chainId);
  const encoded = await encodeOffer(bundle, 2);

  expect(bundle).toMatchSnapshot("bundle");
  expect(encoded).toMatchSnapshot("offer");
});

async function localPuzzleApiCall(parentCoinId: string): Promise<GetParentPuzzleResponse | undefined> {
  const knownCoins = [
    { "parentCoinId": "0xd538ae235752c68078884bfb129e2c0832c2d8ed67674bde6c9a48603e6b875e", "amount": 159, "parentParentCoinId": "0x0cd93529333db5ffcb7aef5a1f9610df8467ae739b083697479dbb88a82467f5", "puzzleReveal": "0xff02ffff01ff02ffff01ff02ff5effff04ff02ffff04ffff04ff05ffff04ffff0bff2cff0580ffff04ff0bff80808080ffff04ffff02ff17ff2f80ffff04ff5fffff04ffff02ff2effff04ff02ffff04ff17ff80808080ffff04ffff0bff82027fff82057fff820b7f80ffff04ff81bfffff04ff82017fffff04ff8202ffffff04ff8205ffffff04ff820bffff80808080808080808080808080ffff04ffff01ffffffff81ca3dff46ff0233ffff3c04ff01ff0181cbffffff02ff02ffff03ff05ffff01ff02ff32ffff04ff02ffff04ff0dffff04ffff0bff22ffff0bff2cff3480ffff0bff22ffff0bff22ffff0bff2cff5c80ff0980ffff0bff22ff0bffff0bff2cff8080808080ff8080808080ffff010b80ff0180ffff02ffff03ff0bffff01ff02ffff03ffff09ffff02ff2effff04ff02ffff04ff13ff80808080ff820b9f80ffff01ff02ff26ffff04ff02ffff04ffff02ff13ffff04ff5fffff04ff17ffff04ff2fffff04ff81bfffff04ff82017fffff04ff1bff8080808080808080ffff04ff82017fff8080808080ffff01ff088080ff0180ffff01ff02ffff03ff17ffff01ff02ffff03ffff20ff81bf80ffff0182017fffff01ff088080ff0180ffff01ff088080ff018080ff0180ffff04ffff04ff05ff2780ffff04ffff10ff0bff5780ff778080ff02ffff03ff05ffff01ff02ffff03ffff09ffff02ffff03ffff09ff11ff7880ffff0159ff8080ff0180ffff01818f80ffff01ff02ff7affff04ff02ffff04ff0dffff04ff0bffff04ffff04ff81b9ff82017980ff808080808080ffff01ff02ff5affff04ff02ffff04ffff02ffff03ffff09ff11ff7880ffff01ff04ff78ffff04ffff02ff36ffff04ff02ffff04ff13ffff04ff29ffff04ffff0bff2cff5b80ffff04ff2bff80808080808080ff398080ffff01ff02ffff03ffff09ff11ff2480ffff01ff04ff24ffff04ffff0bff20ff2980ff398080ffff010980ff018080ff0180ffff04ffff02ffff03ffff09ff11ff7880ffff0159ff8080ff0180ffff04ffff02ff7affff04ff02ffff04ff0dffff04ff0bffff04ff17ff808080808080ff80808080808080ff0180ffff01ff04ff80ffff04ff80ff17808080ff0180ffffff02ffff03ff05ffff01ff04ff09ffff02ff26ffff04ff02ffff04ff0dffff04ff0bff808080808080ffff010b80ff0180ff0bff22ffff0bff2cff5880ffff0bff22ffff0bff22ffff0bff2cff5c80ff0580ffff0bff22ffff02ff32ffff04ff02ffff04ff07ffff04ffff0bff2cff2c80ff8080808080ffff0bff2cff8080808080ffff02ffff03ffff07ff0580ffff01ff0bffff0102ffff02ff2effff04ff02ffff04ff09ff80808080ffff02ff2effff04ff02ffff04ff0dff8080808080ffff01ff0bff2cff058080ff0180ffff04ffff04ff28ffff04ff5fff808080ffff02ff7effff04ff02ffff04ffff04ffff04ff2fff0580ffff04ff5fff82017f8080ffff04ffff02ff7affff04ff02ffff04ff0bffff04ff05ffff01ff808080808080ffff04ff17ffff04ff81bfffff04ff82017fffff04ffff0bff8204ffffff02ff36ffff04ff02ffff04ff09ffff04ff820affffff04ffff0bff2cff2d80ffff04ff15ff80808080808080ff8216ff80ffff04ff8205ffffff04ff820bffff808080808080808080808080ff02ff2affff04ff02ffff04ff5fffff04ff3bffff04ffff02ffff03ff17ffff01ff09ff2dffff0bff27ffff02ff36ffff04ff02ffff04ff29ffff04ff57ffff04ffff0bff2cff81b980ffff04ff59ff80808080808080ff81b78080ff8080ff0180ffff04ff17ffff04ff05ffff04ff8202ffffff04ffff04ffff04ff24ffff04ffff0bff7cff2fff82017f80ff808080ffff04ffff04ff30ffff04ffff0bff81bfffff0bff7cff15ffff10ff82017fffff11ff8202dfff2b80ff8202ff808080ff808080ff138080ff80808080808080808080ff018080ffff04ffff01a072dec062874cd4d3aab892a0906688a1ae412b0109982e1797a170add88bdcdcffff04ffff01a06e1815ee33e943676ee437a42b7d239c0d0826902480e4c3781fee4b327e1b6bffff04ffff01ff02ffff01ff02ffff01ff02ffff03ff0bffff01ff02ffff03ffff09ff05ffff1dff0bffff1effff0bff0bffff02ff06ffff04ff02ffff04ff17ff8080808080808080ffff01ff02ff17ff2f80ffff01ff088080ff0180ffff01ff04ffff04ff04ffff04ff05ffff04ffff02ff06ffff04ff02ffff04ff17ff80808080ff80808080ffff02ff17ff2f808080ff0180ffff04ffff01ff32ff02ffff03ffff07ff0580ffff01ff0bffff0102ffff02ff06ffff04ff02ffff04ff09ff80808080ffff02ff06ffff04ff02ffff04ff0dff8080808080ffff01ff0bffff0101ff058080ff0180ff018080ffff04ffff01b0b5c7539888af59f601be0ea2eddd32c06a80d932170eec55ef7a7640cbc5b37b81c4258644229eca2322298a9bf0189fff018080ff0180808080" },
  ];
  const resp = knownCoins.find(_ => _.parentCoinId == parentCoinId);
  return resp;
}

test('Make Offer 2', async () => {
  const offplan: OfferPlan[] = [
    {
      "id": "0x6e1815ee33e943676ee437a42b7d239c0d0826902480e4c3781fee4b327e1b6b",
      "plan": {
        "coins": [
          {
            "amount": 100n,
            "parent_coin_info": "0xd538ae235752c68078884bfb129e2c0832c2d8ed67674bde6c9a48603e6b875e",
            "puzzle_hash": "0x9d974f53c5a3d12ef729f38f2c1603b4f4f959a033d0a6ed763fab46a7cc5577"
          }
        ],
        "targets": [
          {
            "address": "0xbae24162efbd568f89bc7a340798a6118df0189eb9e3f8697bcea27af99f8f79",
            "amount": 10n,
            "symbol": "BSH",
            "memos": [
              "0xbae24162efbd568f89bc7a340798a6118df0189eb9e3f8697bcea27af99f8f79"
            ]
          },
          {
            "symbol": "BSH",
            "address": "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96",
            "amount": 90n
          }
        ]
      }
    }
  ];
  const reqs: OfferEntity[] = [
    {
      "id": "",
      "symbol": xchSymbol(),
      "amount": 5n,
      "target": "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96"
    }
  ];
  const account = getTestAccount("46815978e90da660427161c265b400831ee59f9aae9a40b449fbcd67ca140590");
  const tokenPuzzles = await getAccountAddressDetails(account, [], tokenInfo(), xchPrefix(), xchSymbol(), undefined, "cat_v1");

  const nonce = "741f8564b6637aee92dd68548cfe7df8ec35b20029235565244944febd68bf8d";
  const ubundle = await generateOffer(offplan, reqs, tokenPuzzles, net, nonce, "cat_v1");
  const bundle = await signSpendBundle(ubundle, tokenPuzzles, net.chainId);
  const encoded = await encodeOffer(bundle, 2);

  expect(bundle).toMatchSnapshot("bundle");
  expect(encoded).toMatchSnapshot("offer");
});

test('Take Offer Xch For CAT', async () => {
  const offerText = "offer1qqp83w76wzru6cmqvpsxygqqgtz8czhc9m7htaj54ten8j0925a2n80flhclm8y8lshnwepyfuud2rjnqu9ad5t6d66fuxaduarwhww30fh2p6eewzcm0g8gm6q6ga5l9wt40mvck3syykk8cf6cak5vnself3989uk9s7arl08pm29j8syaza7x97wa8uu7nqhartj4nmpuhgfkgxj7rj0pptuh0hjxwhfdn5zzwj6waprhayvzzvstkmhwy96gnrhrww0ucvdnhjde2deavetuka6gmuztlmthuse576dwgh4qjgyh2e7vrmzamxujwerhvymlmwxlgm40cqhw0s9dgxljtaeflny45vcdvsuyz3fqawhwf3ahfx7evh8uh7nh5al39tc7jh6m3h6hdwqemvrycwn7uaudgfckgfnyp6m2062v573c77auzpn0mpl23glattdra2279yjer8kl8u6g8kx6wluvetxdmtpvruhh6tfhxmzezkhgtzjt6t8mj7xdk25wkew6pttd5qzf68l30mr6ujv0gln0tpl70832z0mpnjcy0vl53nxml8uyweh4h9z420l87atcyyaqxygmrnqx23nl7l7pa2587lm5xkkkxe8zskwy64lytcywja2l5a4a25q66swvhl2gdm0qwuqg44l0s23zj9v5ful0s97xvfgh3w2795awuch4rkrnvd04t9hgm8ha6vtte57m6tececa4jytujlc5zc7z86c4tfv74jnz2764ze8wmxml9jlnnva7ap80nxmd8xpwmyla77kdsgv5y5tevmwnyreag7z9wlfwefjfwyqrug4c2cuc00dv";

  const account = getTestAccount("46815978e90da660427161c265b400831ee59f9aae9a40b449fbcd67ca140590");

  const makerBundle = await decodeOffer(offerText);
  const summary = await getOfferSummary(makerBundle);
  const change_hex = "0x907ecc36e25ede9466dc1db20f86d8678b4a518a4351b552fb19be20fc6aac96";
  const nonce = "c616dec58b3c9a898b167f4ea26adb27b464c7e28d2656eeb845a525b9f5786c";
  const tokenPuzzles = await getAccountAddressDetails(account, [], tokenInfo(), xchPrefix(), xchSymbol(), undefined, "cat_v1");
  // const availcoins = await coinHandler.getAvailableCoins(tokenPuzzles, coinHandler.getTokenNames(account));
  const availcoins: SymbolCoins = {
    "BSH": [
      {
        "amount": 100n,
        "parent_coin_info": "0xd538ae235752c68078884bfb129e2c0832c2d8ed67674bde6c9a48603e6b875e",
        "puzzle_hash": "0x9d974f53c5a3d12ef729f38f2c1603b4f4f959a033d0a6ed763fab46a7cc5577"
      }
    ]
  };

  const cats = getCatNameDict(account);
  expect(cats).toMatchSnapshot("cats dict");
  const revSummary = getReversePlan(summary, change_hex, cats);
  expect(revSummary).toMatchSnapshot("reverse summary");
  const offplan = await generateOfferPlan(revSummary.offered, change_hex, availcoins, 0n, xchSymbol());
  expect(offplan).toMatchSnapshot("offer plan");
  const utakerBundle = await generateOffer(offplan, revSummary.requested, tokenPuzzles, net, nonce, "cat_v1");
  const takerBundle = await signSpendBundle(utakerBundle, tokenPuzzles, net.chainId);
  expect(takerBundle).toMatchSnapshot("taker bundle");
  const combined = await combineOfferSpendBundle([makerBundle, takerBundle]);
  await assertSpendbundle(combined, net.chainId);
  expect(combined).toMatchSnapshot("bundle");
});

test('Take Offer CAT For Xch', async () => {
  const offerText = "offer1qqp83w76wzru6cmqvpsxygqqwc7hynr6hum6e0mnf72sn7uvvkpt68eyumkhelprk0adeg42nlelk2mpafrgx923m0l4lupujuu7m6vvmjxy042f2esn0hm4nalt3ym0dhrf29e0h9nxc6y69h2s54rzkly49yh8a9k2lr60zg662fakned6dx6s7nt4eqj492v0l3s2chhqxsy0sqkdqvxdamm7ywnp0t098yzel2449djcf3dhtq6gg8wd53e3ua8ms99je6e2hxqedeet94hulx27n8zdejp9tyh8le7ael208halsp8m8r6hnv5smpga6pytnlghvzr2uj8mvs6xmvs68mvs69mq30py53dnkpzuaskj3wnhyz5ame72u42nkf3dnzgddvtsnk3nvgl8ps7lr6gtp0tda697wvr65tz0gt6fmu2tul6tcflxfw6xh9087pe2sn2sd9u89wzzl6wmw5vawsmtgyz99mjgwumlrfk0pp4dc7pkwa9v3l7vdwy0dlgahw6xq7ep5ms638em6ztata27vu86arnw433r4fkjujhnfc5jk6tkehlzqvgltfagqrtdsz6y4l30yr2vqqwxaxtllpy4s8xrgf4z2eh49hs8235l7l6p60c5ted08ll85ffk7xyl499vhy0au6j0hvl2jepfsas2k72rm9hv8jus6nuhlsv67fe4w8p4mkp69cackca8k7n3h4neat94hwswgh0n56nqlmuj4ehj93jwxk8cdlcteg4najd5n22477rkjmalpggsh8qwqu84a6hadwtkf0tufzffkhxycpx6gk5trutlqxs7d3hlym256r2yn9zd34fqj0q2njjpvmh89l6tpdwt9f3wfr77c7eq9cua47hge0sg8w40svjl4lajpw7dltassqm79h8j4aeye7m0ukjr8vcuhhenhllknlavj0sttaj6kwawlhllct7h08aav3lv0skez9gzpk936semac0meg8ldxkmmchj3kre07grqpnwkstyz9uhlz";

  const account = getTestAccount("029f493caf194d4a67a6a5bad588c12ff1f2512f5db7118fd4005492b9dafbb5");

  const makerBundle = await decodeOffer(offerText);
  const summary = await getOfferSummary(makerBundle);
  const change_hex = "0xb379a659194799dfa9171f7770f6935b1644fe48fd6fb596d5df0ac2abff2bda";
  const nonce = "c616dec58b3c9a898b167f4ea26adb27b464c7e28d2656eeb845a525b9f5786c";
  const tokenPuzzles = await getAccountAddressDetails(account, [], tokenInfo(), xchPrefix(), xchSymbol(), undefined, "cat_v1");
  // const availcoins = await coinHandler.getAvailableCoins(tokenPuzzles, coinHandler.getTokenNames(account));
  const availcoins: SymbolCoins = {
    [xchSymbol()]: [
      {
        amount: 7n,
        parent_coin_info: "0x4eb49d82f126a408914ab23552b8aba955dd19c329d1489a0275556c7012b7e7",
        puzzle_hash: "0xb379a659194799dfa9171f7770f6935b1644fe48fd6fb596d5df0ac2abff2bda",
      }
    ]
  };

  const cats = getCatNameDict(account);
  expect(cats).toMatchSnapshot("cats dict");
  const revSummary = getReversePlan(summary, change_hex, cats);
  expect(revSummary).toMatchSnapshot("reverse summary");
  const offplan = await generateOfferPlan(revSummary.offered, change_hex, availcoins, 0n, xchSymbol());
  expect(offplan).toMatchSnapshot("offer plan");
  const utakerBundle = await generateOffer(offplan, revSummary.requested, tokenPuzzles, net, nonce, "cat_v1");
  const takerBundle = await signSpendBundle(utakerBundle, tokenPuzzles, net.chainId);
  expect(takerBundle).toMatchSnapshot("taker bundle");
  const combined = await combineOfferSpendBundle([makerBundle, takerBundle]);
  await assertSpendbundle(combined, net.chainId);
  expect(combined).toMatchSnapshot("bundle");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCatNameDict(_account?: AccountEntity): { [id: string]: string } {
  const cats: PersistentCustomCat[] = [];
  return Object.assign(
    {},
    ...Object.values(tokenInfo()).map((_) => ({ [prefix0x(_.id ?? "")]: _.symbol })),
    ...(cats.map((_) => ({ [prefix0x(_.id)]: _.name })))
  );
}