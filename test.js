const assert = require('assert');
const majsoul_contest = require('./majsoul_contest');

function test(){
    console.log("test");

    // 大七星
    // 210808-760fa237-cbba-4a7d-a88a-db4cf67dcfef
    assert.equal(majsoul_contest.custom_fan_name("字一色", {
        tehai : '東東南南西西北北白白發中中'
    }), "大七星", "test failed");

    // 槍槓
    // 210605-b3c4f993-90b1-4dc0-9e8c-4436c3651ce4
    assert.equal(majsoul_contest.custom_fan_name("国士無双", {
        prev_action: {name : 'RecordAnGangAddGang', data: {type : 2}}
    }), "国士無双(槍槓)", "test failed");
    assert.equal(majsoul_contest.custom_fan_name("国士無双", {
        prev_action: {name : 'RecordAnGangAddGang', data: {type : 3}}
    }), "国士無双(槍槓)", "test failed");
    assert.equal(majsoul_contest.custom_fan_name("国士無双", {
        prev_action: {name : 'RecordAnGangAddGang', data: {type : 1}}
    }), "国士無双", "test failed");


}
test();
  
