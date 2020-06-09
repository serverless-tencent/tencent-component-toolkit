const { cns } = require('tencent-cloud-sdk');
const { TypeError } = require('../../utils/error');

class Cns {
  constructor(credentials = {}, region = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;
    this.cnsClient = new cns(this.credentials);
  }

  haveRecord(newRecord, historyRcords) {
    for (let i = 0; i < historyRcords.length; i++) {
      if (newRecord.recordType == 'CNAME' && newRecord.value.slice(-1) != '.') {
        newRecord.value = `${newRecord.value}.`;
      }
      if (
        newRecord.domain == historyRcords[i].domain &&
        newRecord.subDomain == historyRcords[i].subDomain &&
        newRecord.recordType == historyRcords[i].recordType &&
        newRecord.value == historyRcords[i].value &&
        newRecord.recordLine == historyRcords[i].recordLine
      ) {
        return historyRcords[i];
      }
    }
    return false;
  }

  async deploy(inputs = {}) {
    // 准备一些临时参数
    const recordList = [];
    const recordRelease = [];
    let domainLength = 100;
    let offset = 0;
    const output = { records: [] };

    // 获取线上的域名记录列表
    console.log(`Getting release domain records ... `);
    try {
      while (domainLength == 100) {
        const statusInputs = {
          Action: 'RecordList',
          Region: this.region,
          offset: offset,
          length: domainLength,
          domain: inputs.domain,
        };
        let recordReleaseList = await this.cnsClient.request(statusInputs);
        if (recordReleaseList.code != 0) {
          // 如果没找到Domain，则尝试添加Domain
          try {
            console.log(`Get release domain error.`);
            console.log(`Adding domain ...`);
            await this.cnsClient.request({
              Action: 'DomainCreate',
              Region: this.region,
              domain: inputs.domain,
            });
            output.DNS = 'Please set your domain DNS: f1g1ns1.dnspod.net,  f1g1ns1.dnspod.net';
            console.log(`Added domain`);
          } catch (e) {
            console.log(`Add domain error`);
            console.log(`Trying to deploy ...`);
          }
          break;
        }
        recordReleaseList = recordReleaseList['data'];
        if (recordReleaseList['records']) {
          for (let i = 0; i < recordReleaseList['records'].length; i++) {
            recordRelease.push({
              domain: inputs.domain,
              subDomain: recordReleaseList['records'][i].name,
              recordType: recordReleaseList['records'][i].type,
              value: recordReleaseList['records'][i].value,
              recordId: recordReleaseList['records'][i].id,
              mx: recordReleaseList['records'][i].mx,
              ttl: recordReleaseList['records'][i].ttl,
              recordLine: recordReleaseList['records'][i].line,
            });
          }
          domainLength = recordReleaseList['records'].length;
        } else {
          domainLength = 0;
        }
        offset = offset + 1;
      }
      console.log(`Getted release domain.`);
    } catch (e) {}

    const records = [];
    for (let recordNum = 0; recordNum < inputs.records.length; recordNum++) {
      const tempSubDomain =
        typeof inputs.records[recordNum].subDomain == 'string'
          ? [inputs.records[recordNum].subDomain]
          : inputs.records[recordNum].subDomain;
      const tempRecordLine =
        typeof inputs.records[recordNum].recordLine == 'string'
          ? [inputs.records[recordNum].recordLine]
          : inputs.records[recordNum].recordLine;

      for (let subDomainNum = 0; subDomainNum < tempSubDomain.length; subDomainNum++) {
        for (let recordLineNum = 0; recordLineNum < tempRecordLine.length; recordLineNum++) {
          const tempRecord = JSON.parse(JSON.stringify(inputs.records[recordNum]));
          tempRecord.subDomain = tempSubDomain[subDomainNum];
          tempRecord.recordLine = tempRecordLine[recordLineNum];
          records.push(tempRecord);
        }
      }
    }

    // 增加/修改记录
    console.log(`Doing action about domain records ... `);
    for (let recordNum = 0; recordNum < records.length; recordNum++) {
      const tempInputs = JSON.parse(JSON.stringify(records[recordNum]));
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
        console.log(`Modifying (recordId is ${tempInputs.recordId})... `);
        tempInputs.Action = 'RecordModify';
        try {
          const modifyResult = await this.cnsClient.request(tempInputs);
          if (modifyResult.code != 0) {
            throw new TypeError(`API_CNS_RecordModify`, JSON.stringify(modifyResult));
          }
        } catch (e) {
          throw new TypeError(`API_CNS_RecordModify`, e.message, e.stack);
        }
        console.log(`Modified (recordId is ${tempInputs.recordId}) `);
      } else {
        // 新建
        console.log(`Creating ... `);
        tempInputs.Action = 'RecordCreate';
        try {
          let createOutputs = await this.cnsClient.request(tempInputs);
          if (createOutputs.code != 0) {
            throw new TypeError(`API_CNS_RecordCreate`, JSON.stringify(createOutputs));
          }
          createOutputs = createOutputs['data'];
          tempInputs.recordId = createOutputs.record.id;
        } catch (e) {
          throw e;
        }
        console.log(`Created (recordId is ${tempInputs.recordId}) `);
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
      console.log(`Modifying status to ${tempInputs.status} `);
      const statusInputs = {
        Action: 'RecordStatus',
        Region: this.region,
        domain: inputs.domain,
        recordId: tempInputs.recordId,
        status: tempInputs.status,
      };
      try {
        const statusResult = await this.cnsClient.request(statusInputs);
        if (statusResult.code != 0) {
          throw new TypeError(`API_CNS_RecordStatus`, JSON.stringify(statusResult));
        }
      } catch (e) {
        throw new TypeError(`API_CNS_RecordStatus`, e.message, e.stack);
      }
      console.log(`Modified status to ${tempInputs.status} `);
    }
    return output;
  }

  async remove(inputs = {}) {
    const deleteList = inputs.deleteList || [];

    if (deleteList.length > 0) {
      console.log(
        `Deleting records which deployed by this project, but not in this records list. `,
      );
      for (let recordNum = 0; recordNum < deleteList.length; recordNum++) {
        console.log(
          `Deleting record ${deleteList[recordNum].subDomain} ${deleteList[recordNum].recordId} `,
        );
        const deleteInputs = {
          Action: 'RecordDelete',
          Region: this.region,
          domain: deleteList[recordNum].domain,
          recordId: deleteList[recordNum].recordId,
        };
        try {
          const deleteResult = await this.cnsClient.request(deleteInputs);
          if (deleteResult.code != 0) {
            console.log(`Error API_CNS_RecordDelete: ${JSON.stringify(deleteResult)}`);
          }
        } catch (e) {
          console.log(`Error API_CNS_RecordDelete: ${e.message}`);
        }
        console.log(
          `Deleted record ${deleteList[recordNum].subDomain} ${deleteList[recordNum].recordId} `,
        );
      }
    }
    return true;
  }
}

module.exports = Cns;
