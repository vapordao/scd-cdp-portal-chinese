import web3 from './web3';
import Promise from 'bluebird';
import { toHex } from './helpers';
import Transport from "@ledgerhq/hw-transport-u2f";
import Eth from "@ledgerhq/hw-app-eth";
import Tx from 'ethereumjs-tx';

// const settings = require('./settings');
const promisify = Promise.promisify;
const schema = {};

schema.tub = require('./abi/saitub');
schema.top = require('./abi/saitop');
schema.tap = require('./abi/saitap');
schema.vox = require('./abi/saivox');
schema.proxyregistry = require('./abi/proxyregistry');
schema.dsproxy = require('./abi/dsproxy');
schema.dsethtoken = require('./abi/dsethtoken');
schema.dstoken = require('./abi/dstoken');
schema.dsvalue = require('./abi/dsvalue');

export const objects = {
}

export const getAccounts = () => {
  return promisify(web3.eth.getAccounts)();
}

export const loadObject = (type, address, label = null) => {
  const object = web3.eth.contract(schema[type].abi).at(address);
  if (label) {
    objects[label] = object;
  }
  return object;
}

export const setDefaultAccount = account => {
  web3.eth.defaultAccount = account;
}

export const getNetwork = () => {
  return promisify(web3.version.getNetwork)();
}

export const getGasPrice = () => {
  return promisify(web3.eth.getGasPrice)();
}

export const estimateGas = (to, data, value, from) => {
  return promisify(web3.eth.estimateGas)({to, data, value, from});
}

export const getTransaction = tx => {
  return promisify(web3.eth.getTransaction)(tx);
}

export const getTransactionReceipt = tx => {
  return promisify(web3.eth.getTransactionReceipt)(tx);
}

export const getTransactionCount = address => {
  return promisify(web3.eth.getTransactionCount)(address, 'pending');
}

export const getNode = () => {
  return promisify(web3.version.getNode)();
}

export const getBlock = block => {
  return promisify(web3.eth.getBlock)(block);
}

export const setFilter = (fromBlock, address) => {
  return promisify(web3.eth.filter)({fromBlock, address});
}

export const resetFilters = bool => {
  web3.reset(bool);
}

export const getEthBalanceOf = addr => {
  return promisify(web3.eth.getBalance)(addr);
}

export const getTokenBalanceOf = (token, addr) => {
  return promisify(objects[token].balanceOf)(addr);
}

export const getTokenAllowance = (token, from, to) => {
  return promisify(objects[token].allowance.call)(from, to);
}

export const getTokenTrusted = (token, from, to) => {
  return promisify(objects[token].allowance.call)(from, to)
        .then((result) => result.eq(web3.toBigNumber(2).pow(256).minus(1)));
}

export const tokenApprove = (token, dst, gasPrice) => {
  return promisify(objects[token].approve)(dst, -1, {gasPrice});
}

/*
   On the contract side, there is a mapping (address) -> []DsProxy
   A given address can have multiple proxies. Since lists cannot be
   iterated, the way to access a give element is access it by index
 */
export const getProxy = (account, proxyIndex) => {
  return promisify(objects.proxyRegistry.proxies)(account, proxyIndex);
}

export const getProxiesCount = account => {
  return promisify(objects.proxyRegistry.proxiesCount)(account);
}

export const getProxyAddress = account => {
  if (!account) return null;
  return getProxiesCount(account).then(async r => {
    if (r.gt(0)) {
      for (let i = r.toNumber() - 1; i >= 0; i--) {
        const proxyAddr = await getProxy(account, i);
        if (await getProxyOwner(proxyAddr) === account) {
          return proxyAddr;
        }
      }
    }
    return null;
  });
}

export const getProxyOwner = proxy => {
  return promisify(loadObject('dsproxy', proxy).owner)();
}

export const proxyExecute = (proxyAddr, targetAddr, calldata, gasPrice, value = 0) => {
  const proxyExecuteCall = loadObject('dsproxy', proxyAddr).execute['address,bytes'];
  return promisify(proxyExecuteCall)(targetAddr,calldata, {value, gasPrice});
}

export const getContractAddr = (contractFrom, contractName) => {
  return new Promise((resolve, reject) => {
    objects[contractFrom][contractName].call((e, r) => {
      if (!e) {
        if (schema[contractName]) {
          loadObject(contractName, r, contractName);
        }
        resolve(r);
      } else {
        reject(e);
      }
    });
  });
}

export const getAllowance = (token, srcAddr, dstAddr) => {
  return new Promise((resolve, reject) => {
    objects[token].allowance.call(srcAddr, dstAddr, (e, r) => {
      if (!e) {
        resolve(r);
      } else {
        reject(e);
      }
    });
  });
}

export const isMetamask = () => web3.currentProvider.isMetaMask || web3.currentProvider.constructor.name === 'MetamaskInpageProvider';

export const initLedger = () => {
  return new Promise((resolve, reject) => {
    Transport.create().then(transport => {
      transport.exchangeTimeout = 10000;
      objects.ledger = new Eth(transport);
      objects.ledger.getAddress("44'/60'/0'/0").then(r => {
        resolve(r.address);
      }, e => reject(e));
    }, e => reject(e));
  });
}

export const signTransactionLedger = (account, to, data, value) => {
  return new Promise(async (resolve, reject) => {
    const tx = new Tx({
      nonce: toHex(await getTransactionCount(account)),
      gasPrice: toHex(await getGasPrice()),
      gasLimit: parseInt(await estimateGas(to, data, value, account) * 1.5, 10),
      to,
      value: toHex(value),
      data,
      v: parseInt(await getNetwork(), 10)
    });
    objects.ledger.signTransaction("44'/60'/0'/0", tx.serialize().toString('hex')).then(sig => {
      tx.v = "0x" + sig['v'];
      tx.r = "0x" + sig['r'];
      tx.s = "0x" + sig['s'];
      web3.eth.sendRawTransaction("0x" + tx.serialize().toString('hex'), (e, r) => {
        if (!e) {
          resolve(r);
        } else {
          reject(e);
        }
      });
    }, e => reject(e));
  });
}