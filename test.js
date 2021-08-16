const assert = require('assert');
const majsoul_contest = require('./majsoul_contest');

function test(){
    console.log("test");
    assert.equal(majsoul_contest.custom_fan_name("字一色", {
        tehai : '東東南南西西北北白白發中中'
    }), "大七星", "test failed");
}
test();
  
