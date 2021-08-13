import { Data } from "@ganache/utils";
import type Common from "@ethereumjs/common";
import { LegacyTransaction } from "./legacy-transaction";
import { EIP2930AccessListTransaction } from "./eip2930-access-list-transaction";
import { TypedRpcTransaction } from "./rpc-transaction";
import {
  EIP2930AccessListDatabasePayload,
  LegacyDatabasePayload,
  TypedDatabasePayload,
  TypedDatabaseTransaction
} from "./raw";
import { decode } from "@ganache/rlp";

const UNTYPED_TX_START_BYTE = 0xc0; // all txs with first byte >= 0xc0 are untyped
const LEGACY_TX_TYPE_ID = 0x0;
const ACCESS_LIST_TX_TYPE_ID = 0x1;

export class TransactionFactory {
  private static _fromData(
    txData: TypedRpcTransaction | TypedDatabasePayload,
    txType: typeof EIP2930AccessListTransaction | typeof LegacyTransaction,
    common
  ) {
    if (txType === LegacyTransaction) {
      // TODO: this could be send _with_ a txType even though EIP-2718 isn't activated. Do we care?
      return txType.fromTxData(
        <LegacyDatabasePayload | TypedRpcTransaction>txData,
        common
      );
    } else {
      if (common.isActivatedEIP(2718)) {
        if (txType === EIP2930AccessListTransaction) {
          if (common.isActivatedEIP(2930)) {
            return txType.fromTxData(
              <EIP2930AccessListDatabasePayload | TypedRpcTransaction>txData,
              common
            );
          } else {
            // TODO: I believe this is unreachable with current architecture.
            // If 2718 is supported, so is 2930.
            throw new Error(`EIP 2930 is not activated.`);
          }
        } else {
          throw new Error(`Tx instantiation with supplied type not supported`);
        }
      } else {
        throw new Error(`EIP 2718 is not activated.`);
      }
    }
  }
  /**
   * Create a transaction from a `txData` object
   *
   * @param txData - The rpc transaction data. The `type` field will determine which transaction type is returned (if undefined, creates a legacy transaction)
   * @param common - Options to pass on to the constructor of the transaction
   */
  public static fromRpc(txData: TypedRpcTransaction, common: Common) {
    const txType = this.typeOfRPC(txData);

    return this._fromData(txData, txType, common);
  }
  /**
   * Create a transaction from a `txData` object
   *
   * @param txData - The raw transaction data. The `type` field will determine which transaction type is returned (if undefined, creates a legacy transaction)
   * @param common - Options to pass on to the constructor of the transaction
   */
  public static fromDatabaseTx(
    txData: TypedDatabaseTransaction,
    common: Common
  ) {
    const typeVal = txData[0][0];
    const data = txData.slice(1, txData.length); // remove type because it's not rlp encoded and thus can't be decoded
    const txType = this.typeOf(typeVal);
    return this._fromData(<TypedDatabasePayload>data, txType, common);
  }
  /**
   * Create a transaction from a `txData` object
   *
   * @param txData - The raw hex string transaction data. The `type` field will determine which transaction type is returned (if undefined, creates a legacy transaction)
   * @param common - Options to pass on to the constructor of the transaction
   */
  public static fromString(txData: string, common: Common) {
    let data = Data.from(txData).toBuffer();
    const type = data[0];
    const txType = this.typeOf(type);
    if (type === undefined || txType !== LegacyTransaction) {
      data = data.slice(1);
    }
    const raw = decode<TypedDatabasePayload>(data);
    return this._fromData(raw, txType, common);
  }

  public static typeOf(type: number) {
    if (
      type >= UNTYPED_TX_START_BYTE ||
      type === LEGACY_TX_TYPE_ID ||
      type === undefined
    ) {
      return LegacyTransaction;
    } else if (type === ACCESS_LIST_TX_TYPE_ID) {
      return EIP2930AccessListTransaction;
    }
  }

  public static typeOfRaw(
    raw: TypedDatabaseTransaction | LegacyDatabasePayload
  ) {
    // length of raw legacy payload. All other TXs will start with the type.
    if (raw.length === 9) {
      return LegacyTransaction;
    }
    const type = raw[0][0];
    return this.typeOf(type);
  }

  public static typeOfRPC(rpc: TypedRpcTransaction) {
    if (!("type" in rpc) || rpc.type === undefined) {
      return LegacyTransaction;
    } else {
      const txType = parseInt(rpc.type);
      return this.typeOf(txType);
    }
  }
}