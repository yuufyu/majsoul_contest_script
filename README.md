# majsoul_contest_script
雀魂 大会戦の結果を集計するために作成したコード

## Requirement
* Node.js : >= v12.13.0
* [Majsoul API Server](https://github.com/yuugata/majsoul_api_server)

## Usage
`majsoul_contest [options] [command]`

### Options:
  * -V, --version                  バージョン情報を表示
  * -h, --help                     コマンドのhelpを表示

### Commands:
* contest [options] <unique_id>  
大会牌譜のログをcsvへ出力
  * Options:
   
    * -o, --output <output>              出力csvファイル名(default: "contests_log_<unix time時間>.csv")
    * -n, --next_index <next_index>      パラメータnext_indexの値 (default: -1)
    * -c, --record_count <record_count>  出力牌譜ログ数(対戦数) (default: 20) ※ "--last_game_uuid" or "--source"が指定された場合は最大999999まで取得する。
    * --last_game_uuid <last_game_uuid>  指定したgame_uuid以降の牌譜ログを取得
    * -s, --source <source>              前回出力したcsvファイルを指定。前回出力したcsvファイル内に記録された対戦以降に行われた対局を取得する。また、前回出力したcsvファイルのデータと最新の牌譜ログデータを連結して出力する。
    * -h, --help                         helpを表示
    
* contest_info <contest_id>      
大会情報を取得する ※大会牌譜を取得するための<unique_id>を取得可能
* help [command]                 
helpを表示
  


