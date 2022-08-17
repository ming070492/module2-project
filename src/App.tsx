import React from 'react';
import logo from './logo.svg';
import './App.css';
import {
  PublicKey,
  Transaction,
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {useEffect , useState } from "react";
import { off } from 'process';
window.Buffer = window.Buffer || require("buffer").Buffer;

type DisplayEncoding = "utf8" | "hex";

type PhantomEvent = "disconnect" | "connect" | "accountChanged";
type PhantomRequestMethod =
  | "connect"
  | "disconnect"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
}

const getProvider = (): PhantomProvider | undefined => {
  if ("solana" in window) {
    // @ts-ignore
    const provider = window.solana as any;
    if (provider.isPhantom) return provider as PhantomProvider;
  }
};

function App() {
  const [generateButtonState, setGenerateButtonState] = useState("standby");
  const [senderWalletStorage, setSenderWallet] = useState("");
  const [senderWalletBalance, setSenderWalletBalance] = useState(0);
  const [senderWalletSecretKey, setSenderWalletSecretKey] = useState([] as any);
  const [connectedWalletBalance, setConnectedWalletBalance] = useState(0);
  const [transferButtonStatus, setTransferButtonStatus] = useState("standby");
  const [txSignature, setTxSignature] = useState("");
  const [provider, setProvider] = useState<PhantomProvider | undefined>(
    undefined
  );
	// create state variable for the wallet key
  const [walletKey, setWalletKey] = useState<PhantomProvider | undefined>(
  undefined
  );

  const generateWallet = async () => {
    setGenerateButtonState("generating");
    let senderWallet = Keypair.generate();
    let bal= await airDropSol(senderWallet.publicKey.toString(), 2);
    setSenderWalletBalance(bal / LAMPORTS_PER_SOL);
    setSenderWallet(senderWallet.publicKey.toString());
    setSenderWalletSecretKey(senderWallet.secretKey);
    setGenerateButtonState("success");
}

const airDropSol: any = async (w: String, amount: number, gas: boolean) => {
  try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const fromAirDropSignature = await connection.requestAirdrop(
          new PublicKey(w),
          amount * LAMPORTS_PER_SOL
      );
      
      let latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: fromAirDropSignature
      });

      const walletBalance = await connection.getBalance(
          new PublicKey(w)
      );
      if(gas){
        setSenderWalletBalance(walletBalance / LAMPORTS_PER_SOL);
        setTransferButtonStatus("standby");
      }else{
        return walletBalance;
      }
      
  } catch (err) {
      console.log(err);
  }
}

  // this is the function that runs whenever the component updates (e.g. render, refresh)
  useEffect(() => {
	  const provider = getProvider();
		// if the phantom provider exists, set this as the provider
	  if (provider) setProvider(provider);
	  else setProvider(undefined);
  }, []);

  /**
   * @description prompts user to connect wallet if it exists.
	 * This function is called when the connect wallet button is clicked
   */
  const connectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

		// checks if phantom wallet exists
    if (solana) {
      try {
				// connects wallet and returns response which includes the wallet public key
        const response = await solana.connect();
        //console.log('wallet account ', response.publicKey.toString());
				// update walletKey to be the public key
        setWalletKey(response.publicKey.toString());
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const walletBalance = await connection.getBalance(
            new PublicKey(response.publicKey.toString())
        );
        setConnectedWalletBalance(walletBalance / LAMPORTS_PER_SOL);
      } catch (err) {
      // { code: 4001, message: 'User rejected the request.' }
      }
    }
  };

  const disconnectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

    if (walletKey && solana) {
      await (solana as PhantomProvider).disconnect();
      setWalletKey(undefined);
    }
  };
    
  


  const transferSol = async (sender: String, receiver: String, amount: number) => {
    setTransferButtonStatus("sending");
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const senderPublicKey = new PublicKey(sender);
    const receiverPublicKey = new PublicKey(receiver);
    const secret = Uint8Array.from(senderWalletSecretKey);
    const senderKeypair = Keypair.fromSecretKey(secret);
    
    try {
      var transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: senderPublicKey,
          toPubkey: receiverPublicKey,
          lamports: amount * LAMPORTS_PER_SOL
      })
      );
      var signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [senderKeypair]
      );
      setTxSignature(signature);
      setTransferButtonStatus("success");
    } catch(e) {
      setTransferButtonStatus("failed");
    }
    
    const walletBalanceR = await connection.getBalance(receiverPublicKey);
    setConnectedWalletBalance(walletBalanceR / LAMPORTS_PER_SOL);
    const walletBalanceS = await connection.getBalance(senderPublicKey);
    setSenderWalletBalance(walletBalanceS / LAMPORTS_PER_SOL);
  }




  return (
    <div className='App'>
      <div>
        {senderWalletStorage === "" && generateButtonState === 'standby' && (<button onClick={generateWallet}>CREATE NEW SOLANA ACCOUNT</button>)}
        {senderWalletStorage === "" && generateButtonState === 'generating' && (<button disabled>CREATING...</button>)}
        {senderWalletStorage !== "" && (<div><button disabled>ACCOUNT CREATED</button><p><span className='bold'>SENDER ADDRESS:</span> {senderWalletStorage}</p>
          {senderWalletBalance <= 0 && <p><span className='bold'>BALANCE:</span> Airdropping... </p>}
          {senderWalletBalance > 0 && <p><span className='bold'>BALANCE:</span> <span className='bal'>{senderWalletBalance}</span> SOL</p>}
          {senderWalletBalance > 0 && <div>
            {provider && !walletKey && (
              <button onClick={connectWallet}>CONNECT WALLET</button>
            )}
            {provider && walletKey && <div>
              <button onClick={disconnectWallet}>DISCONNECT WALLET</button>
              <p><span className='bold'>CONNECTED WALLET:</span> {walletKey.toString()}</p>
              <p><span className='bold'>BALANCE:</span> <span className='bal'>{connectedWalletBalance}</span> SOL</p>
              {transferButtonStatus === "standby" &&
              <button onClick={() => transferSol(senderWalletStorage, walletKey.toString(), 2)}>TRANSFER SOL</button>
              }
              {transferButtonStatus === "sending" &&
              <button>SENDING...</button>
              }
              {transferButtonStatus === "success" &&
              <div><button onClick={() => transferSol(senderWalletStorage, walletKey.toString(), 2)}>TRANSFER SOL</button><p className='bold success label'>SUCCESS</p><p><span className='bold'>SIGNATURE:</span> {txSignature}</p></div>
              }
              {transferButtonStatus === "failed" &&
              <div><button onClick={() => transferSol(senderWalletStorage, walletKey.toString(), 2)}>TRANSFER SOL</button><p className='bold failed label'>FAILED</p><p><span className='bold'>ERROR:</span> INSUFFICIENT BALANCE (Custom Program Error: 0x1)</p><div className='smallButton' onClick={() => airDropSol(senderWalletStorage, 1, true)}>AIRDROP</div></div>
              }
            </div>}
            {!provider && (
              <p>
                No provider found. Install{" "}
                <a href="https://phantom.app/">Phantom Browser extension</a>
              </p>
            )}
            </div>
          }
        </div>)}
      </div>
    </div>
  );
}



export default App;
