import {createNodeTestManager} from './createNodeTestManager';

const testManager = createNodeTestManager();

testManager.start();

const {
  beforeEach,
  afterEach,
  afterWarmup,
  beforeBatch,
  afterBatch,
  beforeIteration,
  afterIteration,
  describe,
  test,
} = testManager.protocol;

export {
  beforeEach,
  afterEach,
  afterWarmup,
  beforeBatch,
  afterBatch,
  beforeIteration,
  afterIteration,
  describe,
  test,
};
