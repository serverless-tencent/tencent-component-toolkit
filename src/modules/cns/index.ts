import { CapiCredentials, RegionType, ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS, { ActionType } from './apis';
import { getRealType, deepClone } from '../../utils';
import { CnsRecordInputs, CnsDeployInputs, CnsRecordOutputs, CnsDeployOutputs } from './interface';

export default class Cns {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials = {}, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.cns,
      // FIXME: AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  haveRecord(newRecord: CnsRecordInputs, historyRecords: CnsRecordInputs[]) {
    if (newRecord.recordType === 'CNAME' && newRecord.value.slice(-1) !== '.') {
      newRecord.value = `${newRecord.value}.`;
    }
    const [exist] = historyRecords.filter((item) => {
      return (
        newRecord.domain === item.domain &&
        newRecord.subDomain === item.subDomain &&
        newRecord.recordType === item.recordType &&
        newRecord.value === item.value &&
        newRecord.recordLine === item.recordLine
      );
    });
    return exist;
  }

  async getAllRecordList(domain: string): Promise<CnsRecordOutputs[]> {
    const maxLength = 100;
    const reqOptions = {
      Action: 'RecordList' as const,
      domain: domain,
      length: maxLength,
      offset: 0,
    };

    let loopTimes = 0;
    const loopGetList = async (offset: number): Promise<CnsRecordOutputs[]> => {
      reqOptions.offset = offset;
      try {
        const { records } = await this.request(reqOptions);
        if (records.length < maxLength) {
          return records;
        }
        loopTimes++;
        return records.concat(await loopGetList(offset + loopTimes * maxLength));
      } catch (e) {
        console.log(e);
        return [];
      }
    };

    console.log(`Getting release domain records`);
    const list = await loopGetList(0);
    return list;
  }

  async deploy(inputs: CnsDeployInputs = {} as any) {
    const output: CnsDeployOutputs = { records: [] };
    const allList = await this.getAllRecordList(inputs.domain);
    const existRecords = allList.map(
      (item): CnsRecordInputs => ({
        domain: inputs.domain,
        subDomain: item.name,
        recordType: item.type,
        value: item.value,
        recordId: item.id,
        mx: item.mx,
        ttl: item.ttl,
        recordLine: item.line,
      }),
    );

    const newRecords: CnsRecordInputs[] = [];
    inputs.records.forEach((item) => {
      const tempSubDomain =
        getRealType(item.subDomain) === 'String' ? [item.subDomain] : item.subDomain;
      const tempRecordLine =
        getRealType(item.recordLine) === 'String' ? [item.recordLine] : item.recordLine;

      for (let j = 0; j < tempSubDomain.length; j++) {
        for (let recordLineNum = 0; recordLineNum < tempRecordLine.length; recordLineNum++) {
          const tempRecord = deepClone(item);
          tempRecord.subDomain = tempSubDomain[j];
          tempRecord.recordLine = tempRecordLine[recordLineNum];
          tempRecord.status = tempRecord.status || 'enable';
          tempRecord.domain = inputs.domain;
          newRecords.push(tempRecord);
        }
      }
    });

    for (let i = 0; i < newRecords.length; i++) {
      const curRecord = newRecords[i];
      const tempInputs = deepClone(curRecord);
      console.log(`Resolving ${tempInputs.subDomain} - ${tempInputs.value}`);
      const exist = this.haveRecord(tempInputs, existRecords);
      if (tempInputs.recordId || exist) {
        if (!tempInputs.recordId) {
          tempInputs.recordId = exist.recordId;
        }

        console.log(`Modifying dns record ${tempInputs.recordId}`);
        await this.request({
          ...tempInputs,
          recordId: Number(tempInputs.recordId),
          Action: 'RecordModify',
        });
        console.log(`Modified dns record ${tempInputs.recordId} success`);
      } else {
        console.log(`Creating dns record`);
        const data = await this.request({ ...tempInputs, Action: 'RecordCreate' });
        tempInputs.recordId = data.record.id;
        console.log(`Created dns record ${tempInputs.recordId}`);
      }
      // add outputs
      output.records.push({
        subDomain: tempInputs.subDomain,
        recordType: tempInputs.recordType,
        recordLine: tempInputs.recordLine,
        recordId: tempInputs.recordId,
        value: tempInputs.value,
        status: tempInputs.status,
        domain: inputs.domain,
      });
      console.log(`Modifying status to ${tempInputs.status}`);
      const statusInputs = {
        Action: 'RecordStatus' as const,
        domain: inputs.domain,
        recordId: tempInputs.recordId,
        status: tempInputs.status,
      };
      console.log(statusInputs);
      await this.request(statusInputs);
      console.log(`Modified status to ${tempInputs.status}`);
    }
    return output;
  }

  async remove(inputs: { records: CnsRecordInputs[] } = {} as any) {
    const { records = [] } = inputs;

    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const curRecord = records[i];
        console.log(`Removing record ${curRecord.subDomain} ${curRecord.recordId}`);
        const deleteInputs = {
          Action: 'RecordDelete' as const,
          domain: curRecord.domain,
          recordId: curRecord.recordId,
        };
        await this.request(deleteInputs);
        console.log(`Remove record ${curRecord.subDomain} ${curRecord.recordId} success`);
      }
    }
    return true;
  }
}

module.exports = Cns;
