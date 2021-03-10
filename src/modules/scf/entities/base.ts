import { Capi } from '@tencent-sdk/capi';
import { pascalCaseProps } from '../../../utils';
import APIS, { ActionType } from '../apis';

export default class BaseEntity {
  capi: Capi;

  constructor(capi: Capi) {
    this.capi = capi;
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, pascalCaseProps(data));
    return result;
  }
}
