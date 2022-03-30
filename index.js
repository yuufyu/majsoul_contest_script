'use strict';

const program = require('commander');
const majsoul_contest = require('./majsoul_contest');

/* start */
(async () => {
    const default_log_file_suffix = `${new Date().getTime()}.csv`;
    program.version("0.0.1");

    program
        .command("contest <unique_id>")
        .option('-o, --output <output>', 'Output csv file', "contests_log_" + default_log_file_suffix)
        //.option('-r, --retry <retry_count>', 'Max retry count', 5)
        .option('-n, --next_index <next_index>', 'Next index param', -1)
        .option('-c, --record_count <record_count>', 'Count of records', 20)
        .option('--last_game_uuid <last_game_uuid>', 'Last game_uuid')
        .option('-s, --source <source>', 'Last record log file')
        .description("fetch contest record")
        .action(majsoul_contest.fetch_contest_record);

    program
        .command("contest_info <contest_id>")
        .description("fetch contest info")
        .action(majsoul_contest.fetch_contest_info);
        
    program
        .command("contest_by_contest_id <contest_id>")
        .option('-o, --output <output>', 'Output csv file', "contests_log_" + default_log_file_suffix)
        .option('-n, --next_index <next_index>', 'Next index param', -1)
        .option('-c, --record_count <record_count>', 'Count of records', 20)
        .option('--last_game_uuid <last_game_uuid>', 'Last game_uuid')
        .option('-s, --source <source>', 'Last record log file')
        .description("fetch contest record by contest_id")
        .action(majsoul_contest.fetch_contest_by_contest_id);
        
    program
        .command("download_contest <unique_id>")
        .option('--last_game_uuid <last_game_uuid>', 'Last game_uuid')
        .option('-c, --record_count <record_count>', 'Count of records', 9999999)
        .option('-n, --next_index <next_index>', 'Next index param', -1)
        .description("download contest record log")
        .action(majsoul_contest.download_contest_log_paipu);

    await program.parseAsync();

    return;

})();
  