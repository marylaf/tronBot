import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
} from "typeorm";

@Entity({ name: "wallets" })
@Unique(["userId", "walletAddress"])
@Unique(["userId", "walletName"])
export class Wallet {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @Column({ type: "varchar", length: 50 })
  username!: string;

  @Column({ name: "wallet_address", type: "varchar", length: 255 })
  walletAddress!: string;

  @Column({ name: "wallet_name", type: "varchar", length: 255 })
  walletName!: string;

  @Column({
    name: "last_known_transaction_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  lastKnownTransactionId!: string | null;
}
