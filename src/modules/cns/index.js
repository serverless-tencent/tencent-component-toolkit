const { Capi } = require('@tencent-sdk/capi');
const Apis = require('./apis');
const { getRealType, deepClone } = require('../../utils');

class Cns {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.capi = new Capi({
      Region: this.region,
      AppId: this.credentials.AppId,
      SecretId: this.credentials.SecretId,
      SecretKey: this.credentials.SecretKey,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }) {
    const result = await Apis[Action](this.capi, data);
    return result;
  }

  haveRecord(newRecord, historyRcords) {
    if (newRecord.recordType === 'CNAME' && newRecord.value.slice(-1) !== '.') {
      newRecord.value = `${newRecord.value}.`;
    }
    const [exist] = historyRcords.filter((item) => {
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

  async getAllRecordList(domain) {
    const maxLength = 100;
    const reqOptions = {
      Action: 'RecordList',
      domain: domain,
      length: maxLength,
    };

    let loopTimes = 0;
    const loopGetList = async (offset) => {
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

  async deploy(inputs = {}) {
    const output = { records: [] };
    const allList = await this.getAllRecordList(inputs.domain);
    const existRecords = allList.map((item) => ({
      domain: inputs.domain,
      subDomain: item.name,
      recordType: item.type,
      value: item.value,
      recordId: item.id,
      mx: item.mx,
      ttl: item.ttl,
      recordLine: item.line,
    }));

    const newRecords = [];
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
        tempInputs.recordId = Number(tempInputs.recordId);
        console.log(`Modifying dns record ${tempInputs.recordId}`);
        tempInputs.Action = 'RecordModify';
        await this.request(tempInputs);
        console.log(`Modified dns record ${tempInputs.recordId} success`);
      } else {
        console.log(`Creating dns record`);
        tempInputs.Action = 'RecordCreate';
        const data = await this.request(tempInputs);
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
        Action: 'RecordStatus',
        domain: inputs.domain,
        recordId: tempInputs.recordId,
        status: tempInputs.status,
      };
      await this.request(statusInputs);
      console.log(`Modified status to ${tempInputs.status}`);
    }
    return output;
  }

  async remove(inputs = {}) {
    const { records = [] } = inputs;

    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const curRecord = records[i];
        console.log(`Removing record ${curRecord.subDomain} ${curRecord.recordId}`);
        const deleteInputs = {
          Action: 'RecordDelete',
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
