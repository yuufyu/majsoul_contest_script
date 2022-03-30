'use strict'

const fs = require('fs');
const fetch = require('node-fetch');
const retry = require('async-retry');
const csvWriter = require('csv-write-stream');
const csvParse = require('csv-parse/lib/sync')

const config = require('./config.js');

class HttpClient {
  async get(url, params) {
    const options = {
      method: 'get',
      muteHttpExceptions: true,
    };
    
    if (params && Object.keys(params).length > 0) {
      url = url + "?" + 
        Object.keys(params).map(function(key) {
          return key + '=' + params[key];
        }).join('&');
    }
    let result;
    await retry(async bail => {
        result = await fetch(url);
        
        if(result.status !== 200){
            throw new Error(`[status=${result.status}]status error`);
        }
    },{
        retries : 5,
        onRetry : (err, num) => {
            console.log(`error occuerd [${err}]: retry (${num})...`); 
        }
    });
    
    const text = await result.text();

    return text;

  }
}

class Majsoul {
  constructor(base_url){
    this.baseURL = base_url;
    this.httpClient = new HttpClient();
    this.HTTP_PARAM = {
      version : "0.0.1",
      source_id : "majsoul_contest"
    };
  }

  async get(url, params){
    if(!params){
      params = {};
    }
    Object.assign(params, this.HTTP_PARAM);
    return await this.httpClient.get(url, params);
  }

  async getContestInfoByContestId(contest_id){
    return JSON.parse(await this.get(this.baseURL + "/contests", {'contest_id' : contest_id}));
  }

  async getListOfRecords(unique_id, last_index){
    let params = {};
    if(last_index >= 0){
        params.last_index = last_index;
    }
    return JSON.parse(await this.get(this.baseURL + "/contests/" + unique_id + "/records", params));
  }

  async getRecords(game_uuid){
    return JSON.parse(await this.get(this.baseURL + "/records/" + game_uuid));
  }
  
  async getRawRecords(game_uuid){
    const log = await this.get(this.baseURL + "/records/" + game_uuid + "?format=raw");
    return log;
  }
}

const RESOURCE_DATA_JSON = require('./data.json');

// majsoulデータをcsvへ書き込めるオブジェクト形式へ変換
function parse_hule(kyoku){
  const resourceJson = RESOURCE_DATA_JSON; // data.json
  const KAZE = ["東", "南", "西", "北"];
  let game_result = [];
  let cur_kyoku = null;
  let new_round_data = null;
  let baojia_seat = -1; // 放銃者を特定するため直前のAction者を保持
  let prev_action = {name : "-", data : null}; // 直前のAction
  kyoku.forEach((r) => {
    const data = r.data;
    switch(r.name){
      case "RecordNewRound" :
      {
        new_round_data = data;
        baojia_seat = data['ju']; // 起家
        cur_kyoku = {
          '場'       : KAZE[data['chang']],
          '局'       : data['ju'] + 1, // 局
          '本場'      : data['ben'] + 1, // 本場
          // '供託立直棒' : data['liqibang']
        };

        break;
      }

      case "RecordDiscardTile":
      case "RecordBaBei" :
      case "RecordAnGangAddGang":
      {
        baojia_seat = data['seat'];
        break;
      }
      case "RecordLiuJu" :
      {
        const round_scores = new_round_data['scores'];
        //abortion
        let type = "unknown";
        if (0 == data.type){
          type = "none";
        }else if (1 == data.type){
          type = "九種九牌";     // 九種九牌 
        }else if (2 == data.type){ 
          type = "四風連打";     // 四風連打
        }else if (3 == data.type){ 
          type = "四槓散了";     // 四槓散了
        }else if (4 == data.type){
          type = "四家立直";     // 四家立直
        }else if (5 == data.type){
          type = "三家和了";     // 三家和了
        }
        // TODO : 四槓散了, 四家立直は点数変動あるが未確認
        Object.assign(cur_kyoku, {
          type : type,
          old_scores : new_round_data['scores'],
          //delta_scores: 

        });
        game_result.push(cur_kyoku);

        break;
      }
    
      case "RecordNoTile" :
      {
        const type = data.liujumanguan ? "流し満貫" : "流局";
        // TODO : 流し満貫の和了情報は未実装。
        // TODO : scoreは一番最初の要素を使用する。2番目以降との違いは不明。-> 複数流し満貫の牌譜を要確認
        const old_scores = data.scores[0].old_scores;
        const delta_scores = data.scores[0].delta_scores;
        const scores = data.scores[0].scores;
        const result = {
          type : type,
          old_scores : old_scores,
          scores : scores ? scores : old_scores,
          delta_scores : delta_scores
        };
        Object.assign(cur_kyoku, result);
        game_result.push(cur_kyoku);

        break;
      }

      case "RecordHule" :
      {
        const type = "和了";
        data.hules.forEach(hule => {
          const fans =  hule.fans.map(e => {
            return {
              id   : e.id,
              name :resourceJson.fan.fan.map_[e.id].name_jp,
              val  : e.val
            };
          });

          let result = {
            type : type,
            yiman : hule.yiman,
            scores : data.scores,
            delta_scores : data.delta_scores, 
            old_scores : data.old_scores,
            fans : fans,
            fu : hule.fu,
            seat : hule.seat,
            from_seat : hule.zimo ? hule.seat : baojia_seat,
            tsumo     : hule.zimo ? "ツモ" : "ロン",
            count : hule.count,
            hand : hule.hand,
            ming : hule.ming,
            hu_pai  : hule.hu_tile,
            hu_tile : convert_pai_str(hule.hu_tile),
            tehai   : tehai_to_string(hule.hand, hule.ming),
            doras : tehai_to_string(hule.doras),
            prev_action : prev_action, // 直前のアクションを保持
            //point : hule.point_sum,
            //liqi : hule.liqi
          };
          
          Object.assign(result, cur_kyoku);// 複数人が和了する場合があるため、オリジナルを変更しない。
          game_result.push(result);
        });
        break;
      }
        
    }
    prev_action = r;
  });

  // メンバをcsvへ出力できるように文字列化
  for(let result of game_result){
    for (const prop in result){
      const val = result[prop];
      if(typeof val == "object"){
        result[prop] = JSON.stringify(val);
      }
    }
  }

  return game_result;

}

function calc_result(hule, allow_kiriagemangan = false){
  let result;
  if(hule.yiman) {
    if(hule.count == 1){
      result = "役満";
    }else if(hule.count == 2){
      result = "二倍役満";
    }else if(hule.count == 3){
      result = "三倍役満";
    }else if(hule.count == 4){
      result = "四倍役満";
    }else if(hule.count == 5){
      result = "五倍役満";
    }else if(hule.count == 6){
      result = "六倍役満";
    }else{
      result = "役満?";
    }
  }else if(13 <= hule.count){
    result = `数え役満(${hule.count}翻)`;
  }else if(11 <= hule.count){
    result = "三倍満";
  }else if(8 <= hule.count){
    result = "倍満";
  }else if(6 <= hule.count){
    result = "跳満";
  }else if(5 <= hule.count || (4 == hule.count && 40 == hule.fu) || (3 <= hule.count && 70 <= hule.fu)){
    result = "満貫";
  }else if(allow_kiriagemangan &&  ((4 == hule.count && 30 == hule.fu) || (3 == hule.count && 60 == hule.fu)) ){
    result = "切り上げ満貫";
  }else{
    result = "和了";
  }

  return result;
}

function convert_pai_str(pai){
  const lookupMajsoulPai = {"0m":"5mr", "0p":"5pr", "0s":"5sr", "1z":"東", "2z":"南", "3z":"西", "4z":"北", "5z":"白", "6z":"發", "7z":"中"};
  const res = lookupMajsoulPai[pai];
  return res ? res : pai ;
}

function tehai_to_string(hand, ming) {
  const reg = /([a-z0-9]+)(,|\))/g;
  let hand_str = hand.map(convert_pai_str).join("");

  if (ming) {
    const ming_arr = ming.map((m) => {
      let m_arr = [];
      let m_;
      while (null !== (m_ = reg.exec(m))) {
        const pai = convert_pai_str(m_[1]);
        m_arr.push(pai);
      }
      return m_arr.join("");
    });

    const ming_str = ming_arr.join(" ");
    hand_str = hand_str + " " + ming_str;
  }
  return hand_str;
}

// CSVのヘッダ
const CSV_HEADER = ["game_uuid","start_time","end_time","場","局","本場","players","player_names","type","hora_result","old_scores","delta_scores","scores","和了者id","和了者名前","tsumo","放銃者id","放銃者名前","fans","count","fu","yaku0", "yaku1", "yaku2", "yaku3", "yaku4", "yaku5","hu_tile","tehai"];

const time_wait = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(); // setTimeoutの第一引数の関数として簡略化できる
    }, ms)
  });
}

async function fetch_contest_record(contest_unique_id, options) {
  let max_record_count = options.record_count;
  let next_index = options.next_index;
  let last_game_uuid = options.last_game_uuid;
  const output_csv_file = options.output;
  const source_csv_file = options.source;
  console.log(contest_unique_id,options);

  let source_records;

  if(source_csv_file){
    const csv_str = fs.readFileSync(source_csv_file);
    source_records = csvParse(csv_str, {columns : true, skip_empty_lines:true});
    if(source_records && source_records.length > 0){
      last_game_uuid = source_records[0].game_uuid;
      console.log(`read log line : ${source_records.length}, last game uuid : ${last_game_uuid}`);
    }
  }

  if(last_game_uuid){
    max_record_count = 999999; // last_game_uuidを優先
  }

  const writer = csvWriter({headers : CSV_HEADER});
  writer.pipe(fs.createWriteStream(output_csv_file));

  const majsoul = new Majsoul(config.mjsoul_server_url);

  let total_count = 0;
  do {
    console.log(`next_index = ${next_index}`);
    const contest_records = await majsoul.getListOfRecords(contest_unique_id, next_index); // 大会牌譜一覧
    next_index = contest_records.next_index;

    if(!contest_records.record_list){
      console.log("Not found record list.");
      break;
    }

    for(const record_info of contest_records.record_list){
      const game_uuid = record_info['uuid'];

      if(last_game_uuid && game_uuid === last_game_uuid){
        next_index = -1; // ループを強制的に脱出
        console.log(`BREAK loop! Because detect last game_uuid(${game_uuid}).`);
        break; 
      }

      console.log(`Get record : ${game_uuid}`);

      const full_record = await majsoul.getRecords(game_uuid); // 牌譜データ

      let hora_log = parse_hule(full_record);

      for(const hora of hora_log) {
        Object.assign(hora, {
          game_uuid : game_uuid,
          start_time : record_info['start_time'],
          end_time :   record_info['end_time'],
          players   : record_info.accounts.map( account => {return account.account_id; }),
          player_names : record_info.accounts.map( account => {return account.nickname;}),
        });

        if(hora.type == "和了"){
          const hora_result = calc_result(hora, record_info.config.mode.detail_rule.have_qieshangmanguan);
          
          // 役集計用列追加
          let agariyaku = [];
          if(hora_result.startsWith('数え役満')){
            agariyaku.push(hora_result);
          }else if(/(.*役満)/g.test(hora_result)){
            const fans_str = hora['fans'];
            const fans = JSON.parse(fans_str).map(fan => {
              return custom_fan_name(fan.name, hora)
            });
            agariyaku.push(...fans);
          }
          const yaku_record = agariyaku.reduce((obj, yaku, idx) => {
            obj["yaku"+idx] = yaku;
            return obj;
          },{});
          
          Object.assign(hora, yaku_record);
          
          Object.assign(hora, {
            '和了者id'    : record_info.accounts[hora.seat].account_id,
            '和了者名前'  : record_info.accounts[hora.seat].nickname,
            '放銃者id'    : record_info.accounts[hora.from_seat].account_id,
            '放銃者名前'  : record_info.accounts[hora.from_seat].nickname,
            'hora_result' : hora_result,
          });
        }
        writer.write(hora);
      }
      total_count++;
    }

  }while(next_index >= 0 && total_count < max_record_count ); // end of do-while
    
  if(source_records && source_records.length > 0){
    source_records.forEach((data) => {
      writer.write(data);
    });
    console.log(`Fetched records : ${total_count}, Source_records : ${source_records.length}`);
  }
  
  writer.end();
  
}

async function download_contest_log_paipu(contest_unique_id, options) {
  let max_record_count = options.record_count;
  let next_index = options.next_index;
  let last_game_uuid = options.last_game_uuid;
  console.log(contest_unique_id,options);
  console.log("contest", contest_unique_id);

  if(last_game_uuid){
    max_record_count = 999999; // last_game_uuidを優先
  }

  const majsoul = new Majsoul(config.mjsoul_server_url);

  let total_count = 0;
  do {
    console.log(`next_index = ${next_index}`);
    const contest_records = await majsoul.getListOfRecords(contest_unique_id, next_index); // 大会牌譜一覧
    next_index = contest_records.next_index;

    if(!contest_records.record_list){
      console.log("Not found record list.");
      break;
    }

    for(const record_info of contest_records.record_list){
      const game_uuid = record_info['uuid'];

      if(last_game_uuid && game_uuid === last_game_uuid){
        next_index = -1; // ループを強制的に脱出
        console.log(`BREAK loop! Because detect last game_uuid(${game_uuid}).`);
        break; 
      }

      console.log(`Get record : ${game_uuid}`);

      const full_record = await majsoul.getRawRecords(game_uuid); // 牌譜データ
      
      const json_log_filename = "logs/log_" + game_uuid + ".json";
      fs.writeFileSync(json_log_filename, full_record);
      time_wait(1000);
      

      // let hora_log = parse_hule(full_record);
      // for(const hora of hora_log) {
      // }
      total_count++;
    }

  }while(next_index >= 0 && total_count < max_record_count ); // end of do-while  
}
// 大七星
function is_daishitisei(hora){
  return /^東東?南南?西西?北北?白白?發發?中中?/.test(hora.tehai);
}

// 槍槓
function is_chankan_kokushi(hora){
  const prev_action = hora.prev_action;
  if(prev_action){
    return prev_action.name == 'RecordAnGangAddGang' && (prev_action.data['type'] == 2 || prev_action.data['type'] == 3);
  }
  return false;
}

function custom_fan_name(fan_name, hora){
  let fan_name_str = fan_name;

  if(is_daishitisei(hora)){
    fan_name_str = "大七星";
  }

  if(is_chankan_kokushi(hora)){
    fan_name_str = "国士無双(槍槓)";
  }

  return fan_name_str;
}

async function fetch_contest_info(contest_id, options) {
  const majsoul = new Majsoul(config.mjsoul_server_url);
  const contest_info = await majsoul.getContestInfoByContestId(contest_id);
  console.log(contest_info);
}

async function fetch_contest_by_contest_id(contest_id, options){
  const majsoul = new Majsoul(config.mjsoul_server_url);
  const contest_info = await majsoul.getContestInfoByContestId(contest_id);
  const unique_id = contest_info['contest_info']['unique_id'];
  console.log(contest_info);
  await fetch_contest_record(unique_id, options);
}

module.exports = {fetch_contest_record, fetch_contest_info, fetch_contest_by_contest_id, custom_fan_name, download_contest_log_paipu};

