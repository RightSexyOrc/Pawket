import { Hex0x } from "@/services/coin/condition";
import { OriginCoin } from "../services/spendbundle";

export interface NftItemAttribute {
  trait_type: string;
  value: string;
  min_value: string;
  max_value: string;
}

export interface NftCollectionAttribute {
  type: string;
  value: string;
}

export interface NftCollection {
  name: string;
  id: string;
  attributes: NftCollectionAttribute[];
}

interface DownloadedNftInfo {
  metadata?: NftOffChainMetadata;
  matchHash?: boolean;
  status: "Ready" | "NoMetadata" | "Downloading" | "Processed";
}

export type DonwloadedNftCollection = { [name: string]: DownloadedNftInfo };

export interface NftOffChainMetadata {
  format: "CHIP-0007";
  name: string;
  description: string;
  minting_tool: string;
  sensitive_content: boolean;
  series_number: number;
  series_total: number;
  attributes: NftItemAttribute[];
  collection: NftCollection;
  levels: string[];
  stats: string[];
  data: unknown;
}

export interface NftCoinAnalysisResult {
  singletonModHash: string;
  launcherId: string;
  launcherPuzzleHash: string;
  nftStateModHash: string;
  metadataUpdaterPuzzleHash: string;
  p2InnerPuzzle: string;
  hintPuzzle: string;
  nftOwnershipModHash: string,
  previousOwner: string;
  didOwner: string;
  p2Owner: string;
  royaltyAddress: Hex0x;
  tradePricePercentage: number;
  rawMetadata: string;
  metadata: NftMetadataValues;
  coin: OriginCoin;
  nextCoinName?: string;
  updaterInSolution?: boolean;
}

export type NftDataKey = "imageUri" | "imageHash" | "metadataUri" | "metadataHash" | "licenseUri" | "licenseHash" | "serialNumber" | "serialTotal";

export interface NftMetadataValues {
  imageUri: string | string[] | undefined;
  imageHash: string | undefined;
  metadataUri: string | string[] | undefined;
  metadataHash: string | undefined;
  licenseUri: string | string[] | undefined;
  licenseHash: string | undefined;
  serialNumber: string | undefined;
  serialTotal: string | undefined;
};
export type NftMetadataKeys = { [key in NftDataKey]: string; };

export interface CnsCoinAnalysisResult extends NftCoinAnalysisResult {
  cnsExpiry: string;
  cnsName: string;
  cnsAddress: string;
}

export interface CnsMetadataValues extends NftMetadataValues {
  expiry: string | undefined;
  address: string | undefined;
  name: string | undefined;
  contentHash: string | undefined;
  text: string | undefined;
  dns: string | undefined;
  publicKey: string | undefined;
  reserved: string | undefined;
};

export type CnsDataKey = NftDataKey | "expiry" | "address" | "name" | "contentHash" | "text" | "dns" | "publicKey" | "reserved";

export type CnsMetadataKeys = { [key in CnsDataKey]: string; };