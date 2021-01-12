import { CapiCredentials, RegionType } from "./interface";

export abstract class CapiBase {
    region: RegionType = RegionType['ap-guangzhou'];
    credentials: CapiCredentials = {};
}