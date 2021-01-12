import { CapiCredentials, RegionType } from './../interface';
import { Cls as ClsClient }  from '@tencent-sdk/cls';
import { ClsDelopyIndexInputs, ClsDeployInputs, ClsDeployLogsetInputs, ClsDeployOutputs, ClsDeployTopicInputs } from './interface';
import  { ApiError } from '../../utils/error';
import { createLogset, createTopic, updateIndex } from './utils';


export default class Cls {
  credentials: CapiCredentials;
  region: RegionType;
  cls: ClsClient;

  constructor(credentials: CapiCredentials, region:RegionType=RegionType['ap-guangzhou'], expire:number) {
    this.region = region;
    this.credentials = credentials;
    this.cls = new ClsClient({
      region: this.region,
      secretId: credentials.SecretId!,
      secretKey: credentials.SecretKey!,
      token: credentials.Token,
      debug: false,
      expire: expire,
    });
  }

  async deployLogset(inputs:ClsDeployLogsetInputs = {} as any) {
    const outputs = {
      region: this.region,
      name: inputs.name,
      period: inputs.period,
      logsetId: '',
    };
    let exist = false;
    const { logsetId } = inputs;
    if (logsetId) {
      const detail = await this.cls.getLogset({
        logset_id: logsetId,
      });
      if (detail.error) {
        throw new ApiError({
          type: 'API_getLogset',
          message: detail.error.message,
        });
      }

      // update it
      if (detail.logset_id) {
        exist = true;
        console.log(`Updating cls ${logsetId}`);
        const res = await this.cls.updateLogset({
          period: inputs.period,
          logset_id: logsetId,
          logset_name: inputs.name,
        });
        if (res.error) {
          throw new ApiError({
            type: 'API_updateLogset',
            message: detail.error!.message!,
          });
        }

        console.log(`Update cls ${logsetId} success`);

        outputs.logsetId = logsetId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createLogset(this.cls, {
        name: inputs.name,
        period: inputs.period,
      });
      outputs.logsetId = res.logset_id;
    }

    return outputs;
  }

  async deployTopic(inputs:ClsDeployTopicInputs) {
    const outputs = {
      region: this.region,
      name: inputs.topic,
      topicId: '',
    };
    let exist = false;
    const { topicId } = inputs;
    if (topicId) {
      const detail = await this.cls.getTopic({
        topic_id: topicId,
      });
      if (detail.error) {
        throw new ApiError({
          type: 'API_getTopic',
          message: detail.error.message,
        });
      }

      // update it
      if (detail.topic_id) {
        exist = true;
        console.log(`Updating cls topic ${topicId}`);
        const res = await this.cls.updateTopic({
          // logset_id: '//FIXME 需要但是没有',
          topic_id: topicId,
          topic_name: inputs.topic,
        } as any);
        if (res.error) {
          throw new ApiError({
            type: 'API_updateTopic',
            message: detail.error!.message,
          });
        }

        console.log(`Update cls topic ${topicId} success`);

        outputs.topicId = topicId;
      }
    }

    // if not exist, create cls
    if (!exist) {
      const res = await createTopic(this.cls, {
        logsetId: inputs.logsetId,
        name: inputs.topic,
      });
      outputs.topicId = res.topic_id;
    }

    return outputs;
  }

  async deployIndex(inputs: ClsDelopyIndexInputs) {
    await updateIndex(this.cls, {
      topicId: inputs.topicId,
      // FIXME: effective is always true in updateIndex
      effective: inputs.effective !== false ? true : false,
      rule: inputs.rule,
    });
  }

  async deploy(inputs: ClsDeployInputs = {} as any) {
    const outputs:ClsDeployOutputs = {
      region: this.region,
      name: inputs.name,
      topic: inputs.topic,
    };

    const logsetOutput = await this.deployLogset(inputs);
    outputs.logsetId = inputs.logsetId = logsetOutput.logsetId;
    const topicOutput = await this.deployTopic(inputs);
    outputs.topicId = inputs.topicId = topicOutput.topicId;
    await this.deployIndex(inputs);

    return outputs;
  }

  async remove(inputs:{topicId:string, logsetId: string} = {} as any) {
    try {
      console.log(`Start removing cls`);
      console.log(`Removing cls topic id ${inputs.topicId}`);
      const res1 = await this.cls.deleteTopic({
        topic_id: inputs.topicId,
      });
      if (res1.error) {
        throw new ApiError({
          type: 'API_deleteTopic',
          message: res1.error.message,
        });
      }
      console.log(`Removed cls topic id ${inputs.logsetId} success`);
      console.log(`Removing cls id ${inputs.logsetId}`);
      const res2 = await this.cls.deleteLogset({
        logset_id: inputs.logsetId,
      });
      if (res2.error) {
        throw new ApiError({
          type: 'API_deleteLogset',
          message: res2.error.message,
        });
      }
      console.log(`Removed cls id ${inputs.logsetId} success`);
    } catch (e) {
      console.log(e);
    }

    return {};
  }
}

