import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectNavigation,readSettlementTask} from '../src/navigation/project-navigation.js';
test('collection and payment links preserve room/shared selectors and observable task state',()=>{
  const location={href:'https://example.test/?room=H&handoffToken=shared&view=seisan'},events=new EventTarget();
  const history={state:{},pushState(state,_,href){this.state=state;location.href=new URL(href,location.href).href;}};
  const navigation=createProjectNavigation({location,history,eventTarget:events});
  for(const task of ['collection','payments','rules','']) {
    navigation.navigateSettlementTask(task);
    assert.deepEqual(readSettlementTask(location.href),{task,invalid:false});
    const p=new URL(location.href).searchParams;
    assert.equal(p.get('room'),'H');assert.equal(p.get('handoffToken'),'shared');assert.equal(p.has('view'),false);
  }
});
test('sample task has a durable history URL and retains sharing selectors',()=>{
  const location={href:'https://example.test/?room=H&handoffToken=shared&section=history-settings'},history={state:{},pushState(state,_,href){location.href=new URL(href,location.href).href;},replaceState(state,_,href){location.href=new URL(href,location.href).href;}},navigation=createProjectNavigation({location,history,eventTarget:new EventTarget()});
  navigation.navigateHistoryTask('sample');assert.deepEqual(JSON.parse(navigation.getHistoryTaskSnapshot()),{task:'sample',invalid:false});assert.equal(new URL(location.href).searchParams.get('handoffToken'),'shared');navigation.replaceHistoryTask('');assert.equal(new URL(location.href).searchParams.has('task'),false);
});
