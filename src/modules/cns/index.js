const { cns } = require('tencent-cloud-sdk');
const { ApiError } = require('../../utils/error');
const { getRealType } = require('../../utils');

class Cns {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.cnsClient = new cns(this.credentials);
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

  async deploy(inputs = {}) {
    // 准备一些临时参数
    const recordList = [];
    const recordRelease = [];
    let domainLength = 100;
    let offset = 0;
    const output = { records: [] };

    // 获取线上的域名记录列表
    console.log(`Getting release domain records`);
    try {
      while (domainLength == 100) {
        const statusInputs = {
          Action: 'RecordList',
          Region: this.region,
          offset: offset,
          length: domainLength,
          domain: inputs.domain,
        };
        const res = await this.cnsClient.request(statusInputs);
        if (res.code !== 0) {
          console.log(`${res.code}: ${res.message}`);
          break;
        }

        const {
          data: { records },
        } = res;
        if (records) {
          for (let i = 0; i < records.length; i++) {
            const curRecord = records[i];
            recordRelease.push({
              domain: inputs.domain,
              subDomain: curRecord.name,
              recordType: curRecord.type,
              value: curRecord.value,
              recordId: curRecord.id,
              mx: curRecord.mx,
              ttl: curRecord.ttl,
              recordLine: curRecord.line,
            });
          }
          domainLength = records.length;
        } else {
          domainLength = 0;
        }
        offset = offset + 1;
      }
      console.log(`Getted release domain.`);
    } catch (e) {}

    const records = [];
    for (let i = 0; i < inputs.records.length; i++) {
      const curRecord = inputs.records[i];
      const tempSubDomain =
        getRealType(curRecord.subDomain) === 'String' ? [curRecord.subDomain] : curRecord.subDomain;
      const tempRecordLine =
        getRealType(curRecord.recordLine) === 'String'
          ? [curRecord.recordLine]
          : curRecord.recordLine;

      for (let j = 0; j < tempSubDomain.length; j++) {
        for (let recordLineNum = 0; recordLineNum < tempRecordLine.length; recordLineNum++) {
          const tempRecord = JSON.parse(JSON.stringify(curRecord));
          tempRecord.subDomain = tempSubDomain[j];
          tempRecord.recordLine = tempRecordLine[recordLineNum];
          records.push(tempRecord);
        }
      }
    }

    for (let i = 0; i < records.length; i++) {
      const curRecord = records[i];
      const tempInputs = JSON.parse(JSON.stringify(curRecord));
      tempInputs.domain = inputs.domain;
      tempInputs.Region = this.region;
      if (!tempInputs.status) {
        tempInputs.status = 'enable'; // 设置默认值
      }
      console.log(`Resolving ${tempInputs.subDomain} - ${tempInputs.value}`);
      const releseHistory = this.haveRecord(tempInputs, recordRelease);
      if (tempInputs.recordId || releseHistory) {
        // 修改
        if (!tempInputs.recordId) {
          tempInputs.recordId = releseHistory.recordId;
        }
        tempInputs.recordId = Number(tempInputs.recordId);
        console.log(`Modifying dns record ${tempInputs.recordId}`);
        tempInputs.Action = 'RecordModify';
        try {
          const modifyResult = await this.cnsClient.request(tempInputs);
          if (modifyResult.code !== 0) {
            throw new ApiError({
              type: `API_CNS_RecordModify`,
              message: modifyResult.message,
              code: modifyResult.code,
            });
          }
        } catch (e) {
          throw new ApiError({
            type: `API_CNS_RecordModify`,
            message: e.message,
            stack: e.stack,
            code: e.code,
          });
        }
        console.log(`Modified dns record ${tempInputs.recordId} success`);
      } else {
        // 新建
        console.log(`Creating dns record`);
        tempInputs.Action = 'RecordCreate';
        try {
          let createOutputs = await this.cnsClient.request(tempInputs);
          if (createOutputs.code !== 0) {
            throw new ApiError({
              type: `API_CNS_RecordCreate`,
              message: createOutputs.message,
              code: createOutputs.code,
            });
          }
          createOutputs = createOutputs['data'];
          tempInputs.recordId = createOutputs.record.id;
        } catch (e) {
          throw new ApiError({
            type: `API_CNS_RecordCreate`,
            message: e.message,
            stack: e.stack,
            code: e.code,
          });
        }
        console.log(`Created dns record ${tempInputs.recordId}`);
      }
      recordList.push(tempInputs);
      output.records.push({
        subDomain: tempInputs.subDomain,
        recordType: tempInputs.recordType,
        recordLine: tempInputs.recordLine,
        recordId: tempInputs.recordId,
        value: tempInputs.value,
        status: tempInputs.status,
        domain: inputs.domain,
      });
      // 改状态
      console.log(`Modifying status to ${tempInputs.status}`);
      const statusInputs = {
        Action: 'RecordStatus',
        Region: this.region,
        domain: inputs.domain,
        recordId: tempInputs.recordId,
        status: tempInputs.status,
      };
      try {
        const statusResult = await this.cnsClient.request(statusInputs);
        if (statusResult.code !== 0) {
          throw new ApiError({
            type: `API_CNS_RecordStatus`,
            message: statusResult.message,
            code: statusResult.code,
          });
        }
      } catch (e) {
        throw new ApiError({
          type: `API_CNS_RecordStatus`,
          message: e.message,
          stack: e.stack,
          code: e.code,
        });
      }
      console.log(`Modified status to ${tempInputs.status}`);
    }
    return output;
  }

  async remove(inputs = {}) {
    const deleteList = inputs.deleteList || [];

    if (deleteList.length > 0) {
      console.log(`Removing records which deployed by this project, but not in this records list`);
      for (let i = 0; i < deleteList.length; i++) {
        const curRecord = deleteList[i];
        console.log(`Removing record ${curRecord.subDomain} ${curRecord.recordId}`);
        const deleteInputs = {
          Action: 'RecordDelete',
          Region: this.region,
          domain: curRecord.domain,
          recordId: curRecord.recordId,
        };
        try {
          const deleteResult = await this.cnsClient.request(deleteInputs);
          if (deleteResult.code !== 0) {
            console.log(`Error API_CNS_RecordDelete: ${JSON.stringify(deleteResult)}`);
          }
        } catch (e) {
          console.log(`Error API_CNS_RecordDelete: ${e.message}`);
        }
        console.log(`Remove record ${curRecord.subDomain} ${curRecord.recordId} success`);
      }
    }
    return true;
  }
}

module.exports = Cns;
