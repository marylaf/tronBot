import TronGrid from "trongrid";
import TronWeb from "tronweb";
import { usdtContractAddress } from "./constants.js";

const tronWeb = new TronWeb({
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
  })

tronWeb.setAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

// const tronGrid = new TronGrid(tronWeb);

export async function getUSDTBalance(walletAddress) {
  try {
    const contract = await tronWeb.contract().at(usdtContractAddress);
    const balance = await contract.balanceOf(walletAddress).call();
    const balanceInUSDT = (tronWeb.toBigNumber(balance).toNumber()/1000000).toFixed();
    const textBalanceMessage = `Текущий баланс: *${balanceInUSDT}* USDT`;
    return textBalanceMessage;
  } catch (error) {
    console.error("Ошибка при получении баланса USDT:", error);
  }
}

// async function getTransactions() {
//     const address = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY';

//     const options = {
//         onlyTo: true,
//         onlyConfirmed: true,
//         limit: 100,
//         orderBy: 'timestamp,asc',
//         minBlockTimestamp: Date.now() - 60000 // from a minute ago to go on
//     };

//     // awaiting
//     const transactions = await tronGrid.account.getTransactions(address, options);
//     console.log({transactions});

//     // promise
//     tronGrid.account.getTransactions(address, options).then(transactions => {
//         console.log({transactions});
//     }).catch(err => console.error(err));

//     // callback
//     tronGrid.account.getTransactions(address, options, (err, transactions) => {
//         if (err)
//             return console.error(err);

//         console.log({transactions});
//     });
// }

// async function getAssets() {
//     const address = 'TXk39yyhzpfbqtU1BATUzpcfQ37L8Tc4Ht';
//     const options = {};

//     // awaiting
//     const assets = await tronGrid.asset.get(address);
//     console.log({assets});

//     // promise
//     tronGrid.asset.get(address, options).then(assets => {
//         console.log({assets});
//     }).catch(err => console.error(err));

//     // callback
//     tronGrid.asset.get(address, options, (err, assets) => {
//         if (err)
//             return console.error(err);

//         console.log({assets});
//     });
// }

// getAccount();
// getTransactions();
// getAssets();
