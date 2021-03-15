import TimerTrigger from './timer';
import CosTrigger from './cos';
import ApigwTrigger from './apigw';
import CkafkaTrigger from './ckafka';
import CmqTrigger from './cmq';
import ClsTrigger from './cls';
import MpsTrigger from './mps';
import ClbTrigger from './clb';
import BaseTrigger from './base';
import { CapiCredentials, RegionType } from '../interface';

export { default as TimerTrigger } from './timer';
export { default as CosTrigger } from './cos';
export { default as ApigwTrigger } from './apigw';
export { default as CkafkaTrigger } from './ckafka';
export { default as CmqTrigger } from './cmq';
export { default as ClsTrigger } from './cls';
export { default as MpsTrigger } from './mps';

const TRIGGER = ({
  timer: TimerTrigger,
  cos: CosTrigger,
  apigw: ApigwTrigger,
  ckafka: CkafkaTrigger,
  cmq: CmqTrigger,
  cls: ClsTrigger,
  mps: MpsTrigger,
  clb: ClbTrigger,
} as any) as Record<
  string,
  BaseTrigger & { new (options: { credentials: CapiCredentials; region: RegionType }): BaseTrigger }
>;

export default TRIGGER;
