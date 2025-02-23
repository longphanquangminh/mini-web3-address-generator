import { HDNodeWallet, Mnemonic } from 'ethers';
import { authenticator } from 'otplib';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const DEFAULT_COUNT = 5;
const MAX_OTP_LENGTH = 6;

const args = process.argv.slice(2);
const showPrivateKey = args.includes('--show-private') || args.includes('-sp');
const noCheck = args.includes('--no-check');

const walletCount = (() => {
  const numArg = args.find(arg => /^\d+$/.test(arg));
  return numArg ? parseInt(numArg, 10) : DEFAULT_COUNT;
})();

const generateWallets = () => {
  const wallets = [];

  let mnemonicPhrase = process.env.SEED_PHRASE || '';
  if (!mnemonicPhrase) {
    const newMnemonic = HDNodeWallet.createRandom();
    mnemonicPhrase = newMnemonic?.mnemonic?.phrase || '';
    console.log(`🔑 Generated new seed phrase:\n${mnemonicPhrase}`);
  }

  for (let i = 0; i < walletCount; i++) {
    try {
      const pathWallet = `m/44'/60'/0'/0/${i}`;
      const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase);
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

function askForOTP(callback: (input: string) => void) {
  const secret = process.env.SECRET_KEY || '';

  if (!secret) {
    console.log('No key found. Exiting...');
    process.exit(0);
  }

  const otp = authenticator.generate(secret);
  console.log(`🔐 Smart OTP (press Enter to confirm or edit):`);

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  let input = otp;
  process.stdout.write(input);

  let cursorPosition = input.length;

  process.stdin.on('keypress', (char, key) => {
    readline.cursorTo(process.stdout, cursorPosition);

    if (key.ctrl || key.meta) {
      return;
    }

    if (key.name === 'return') {
      process.stdout.write('\n');
      process.stdin.setRawMode(false);
      process.stdin.pause();
      callback(input.trim());
      return;
    } else if (key.name === 'backspace' && cursorPosition > 0) {
      input = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
      cursorPosition--;
    } else if (key.name === 'left') {
      cursorPosition = Math.max(0, cursorPosition - 1);
    } else if (key.name === 'right') {
      cursorPosition = Math.min(input.length, cursorPosition + 1);
    } else if (/^[0-9]$/.test(char) && input.length < MAX_OTP_LENGTH) {
      input = input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
      cursorPosition++;
    } else {
      return;
    }

    process.stdout.write(`\r${input.padEnd(MAX_OTP_LENGTH, ' ')}\r`);
    readline.cursorTo(process.stdout, cursorPosition);
  });
}

if (!noCheck) {
  const secret = process.env.SECRET_KEY || '';

  if (secret.length <= 0) {
    console.log('No key found. Exiting...');
  } else {
    askForOTP(input => {
      const secret = process.env.SECRET_KEY || '';
      const otp = authenticator.generate(secret);

      if (input !== otp) {
        console.log('❌ Wrong OTP. Exiting...');
        process.exit(0);
      }

      console.log('✅ OTP verified. Continuing...');
      generateWallets();
    });
  }
} else {
  generateWallets();
}
