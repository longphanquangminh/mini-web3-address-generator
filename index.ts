import { HDNodeWallet, Mnemonic } from 'ethers';
import { authenticator } from 'otplib';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const DEFAULT_COUNT = 5;

const args = process.argv.slice(2);
const showPrivateKey = args.includes('--show-private') || args.includes('-sp');
const noCheck = args.includes('--no-check');

const walletCount = (() => {
  const numArg = args.find(arg => /^\d+$/.test(arg));
  return numArg ? parseInt(numArg, 10) : DEFAULT_COUNT;
})();

const mnemonicPhrase = process.env.SEED_PHRASE || '';

const generateWallets = () => {
  const wallets = [];
  for (let i = 0; i < walletCount; i++) {
    try {
      const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);
      const pathWallet = `m/44'/60'/0'/0/${i}`;
      const wallet = HDNodeWallet.fromMnemonic(mnemonic, pathWallet);
      const { publicKey, address, privateKey } = wallet || {};

      wallets.push({
        number: i + 1,
        publicKey,
        address: address?.toLowerCase(),
        ...(showPrivateKey && { privateKey: privateKey }),
      });
    } catch (error: any) {
      console.error(`Error deriving key ${i}:`, error?.response?.data || error?.message);
    }
  }

  console.log('Generated wallets', wallets);
};

if (!noCheck) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter OTP to continue: ', input => {
    const secret = process.env.SECRET_KEY || '';
    const otp = authenticator.generate(secret);

    if (input.trim().toLowerCase() !== otp) {
      console.log('Wrong OTP. Exiting...');
      rl.close();
      process.exit(0);
    }

    rl.close();
    generateWallets();
  });
} else {
  generateWallets();
}
