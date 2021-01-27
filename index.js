//Bot Discord
const Discord = require("discord.js");
const Client = new Discord.Client;

//config
var config = require('./config.json');

//Music Player
const ytdl = require('ytdl-core');
const { YTSearcher } = require('ytsearcher');
const searcher = new YTSearcher({
    key: "YT_API_KEY",
    revealkey: true,
  });
const queue = new Map();


const prefix = config.other.prefix;

var channelCount = 0;
var tempChan = []

let invites;

//Mysql Db
var mysql = require('mysql');
const { Console } = require("console");

var db = mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
});

db.connect(err => {
    if(err) throw err;
    console.log("Connected to db.")
})

Client.on("ready", async() => {
    console.log("Zertrix bot is on !");

    Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).fetchInvites().then(inv => {
        invites = inv;
    })

    //update infos channels
    var minutes = 3, the_interval = minutes * 60 * 1000;
    setInterval(function() {
      var onlineCount = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.filter(member => member.presence.status !== "offline").size;
      Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.discordCountChannel).setName("Discord : "+onlineCount+ " Online");
    }, the_interval);

    //Store rules message in cache
    Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.reglementChan).messages.fetch(config.ids.channelsid.reglementMessage).then(message =>{
        console.log("Reglement Message bien ajouté au cache");
    }).catch(err => {
        console.log("Erreur pendant la sauveggarde du message reglement auy cache : "+err);
    })
});

Client.on("guildMemberAdd", async(member) => {
    console.log("New player => "+ member.displayName)

    member.guild.fetchInvites().then(gInvites => {

        const invite = gInvites.find((inv) => invites.get(inv.code).uses < inv.uses);
        
        var post  = {invited: member.id, inviter: invite.inviter.id, code: invite.code};
        db.query('INSERT INTO invitation SET ?', post, function (error, results, fields) {
            if (error) throw error;
        });
        db.query('SELECT * FROM `invitation` WHERE `inviter` = '+ invite.inviter.id, function (error, results, fields) {
            const channel = Client.channels.cache.find(channel => channel.id == config.ids.channelsid.leftChan)
            channel.send("\n:beginner: "+ member.displayName+"Vient de nous rejoindre :beginner: \n Nous sommes désormais ** "+ member.guild.memberCount +" ** sur le serveur !\nMerci a *"+invite.inviter.displayName+"* de l'avoir invité ainsi que **"+results.length+"** joueurs\n")
        })

    })


    member.roles.add(config.ids.rolesid.defaultRole).then(mbr => {
        console.log("Role starter attribué a : "+mbr.displayName)
    }).catch((err) => {
        console.log("Error While setting default rank " + err)
    });

    member.roles.remove(config.ids.rolesid.playerRole).then(mbr => {
        console.log("Default role removed to "+ mbr.displayName);
    }).catch(err => {
        console.log("Le role n'as pas pu etre retiré à: "+ err);
    })
    
    
});

Client.on("guildMemberRemove", member => {
    console.log("lost 1 player player => "+ member.displayName)

    const channel = Client.channels.cache.find(channel => channel.id == config.ids.channelsid.welcomeChan)
    channel.send(config.motd.lostMemberStart+member.displayName+config.motd.lostMemberEnd)
});

Client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.channelID;
    let oldUserChannel = oldMember.channelID;
 
    if(newUserChannel === config.ids.channelsid.joinCreate) { 
        channelCount++;

        let category = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.joinCreateCat)

        Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.create('Channel temporaire #'+channelCount, { type: 'voice' }).then(NewChannel => {
            NewChannel.setParent(category.id);
            const member = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id === newMember.id);
            member.voice.setChannel(NewChannel.id)
            tempChan.push(NewChannel.id)

            let roleNewPlayer = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).roles.cache.find(role => role.id === config.ids.rolesid.defaultRole);
            NewChannel.updateOverwrite(roleNewPlayer, { VIEW_CHANNEL: false });
        })
    } else if(tempChan.includes(oldUserChannel)) {
        let chan = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === oldUserChannel)
        var memberCount = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === oldUserChannel).members.filter(member => !member.user.bot).size; 
        if(memberCount < 1) {
            chan.delete()
            tempChan.splice(tempChan.indexOf(oldUserChannel), 1);
            channelCount--;
        }
    }

 });

Client.on("messageReactionAdd", (reaction, user) => {
    if(user.bot) return;

    if(reaction.emoji.name == "✅") {
        var member = reaction.message.guild.members.cache.find(member => member.id === user.id);

        member.roles.add(config.ids.rolesid.playerRole).then(mbr => {
            console.log("Default role added to "+ mbr.displayName);

            member.roles.remove(config.ids.rolesid.defaultRole).then(mbr => {
                console.log("Default role removed to "+ mbr.displayName);
            }).catch(err => {
                console.log("Le role n'as pas pu etre retiré : "+ err);
            })

        }).catch(err => {
            console.log("Le role n'as pas pu etre ajouté à : "+ err);
        })
    } else if(reaction.emoji.name == "🔒"){
        db.query('SELECT * FROM `tickets` WHERE `channelid`='+reaction.message.channel.id, function (error, results, fields) {
            if(results.length > 0){
                reaction.message.channel.delete()
                db.query("UPDATE tickets SET status = 'closed' WHERE channelid="+reaction.message.channel.id, function (error, results, fields) {
                })    
            }
        })
    }
});

Client.on("messageReactionRemove", (reaction, user) => {
    if(user.bot) return;
    var member = reaction.message.guild.members.cache.find(member => member.id === user.id);

    if(reaction.emoji.name == "✅") {
        member.roles.add(config.ids.rolesid.defaultRole).then(mbr => {
            console.log("Default role added to "+ mbr.displayName);

            member.roles.remove(config.ids.rolesid.playerRole).then(mbr => {
                console.log("Default role removed to "+ mbr.displayName);
            }).catch(err => {
                console.log("Le role n'as pas pu etre retiré à: "+ err);
            })

        }).catch(err => {
            console.log("Le role n'as pas pu ajouté retiré : "+ err);
        })
    }
})

Client.on("message", message => {
    if(message.author.bot) return;
    if(message.channel.type == "dm") return;

    const insults = config.other.insults.split(" ");
    let insultD = false;
    insults.forEach(element => {
        if(message.content.includes(" "+element+" ") && !insultD)
        {
            insultD = true;
            message.react("❗")
            const channel = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.logs)

            const embed = new Discord.MessageEmbed()
            .setColor('#FFA500')
            .setTitle("Suspicion d'insulte")
            .setDescription('Un message nous parrait suspect, merci de vérifier:')
            .setThumbnail('https://image.winudf.com/v2/image/c2ltb24uYXBwbGljYXRpb24uR2VuZXJhdGV1ckluc3VsdGVzX2ljb25feWF4Yzhka2o/icon.png?w=170&fakeurl=1')
            .addFields(
                { name: 'Channel :', value: "**"+message.channel.toString()+"**" },
                { name: 'Auteur :', value: "**"+message.member.displayName+"**" },
                { name: 'Message :', value: "**"+message.content+"**" },
                { name: 'Mot Suspect :', value: "**"+element+"**" },
            )
            .setTimestamp()
            .setFooter("En cas d'erreur, n'hésitez pas a contacter le staff.");

            channel.send(embed);
        }
    });

    //Music Queue
    const serverQueue = queue.get(message.guild.id)

    if(message.content.startsWith(prefix+"clear")){
        if(message.member.roles.cache.some(r => config.ids.permissionsid.mute.includes(r.id))) {
            message.channel.messages.fetch()
            .then(function(list){
                    message.channel.bulkDelete(list.size, true);
                    message.reply(config.motd.clearDone)
                    return;
                }, function(err){
                    message.channel.send(config.motd.errorClear)
                    return;
                })  
        }
        return;
    } else if(message.content.startsWith(prefix+"close")){
        if(message.member.roles.cache.some(r => config.ids.permissionsid.mute.includes(r.id))) {
            let roleUpdate = message.guild.roles.cache.find(role => role.id === config.ids.rolesid.playerRole);

            message.channel.updateOverwrite(roleUpdate, { SEND_MESSAGES: false });
            message.reply(config.motd.closed)
        } else {
            message.delete()
        }
        return;
    }  else if(message.content.startsWith(prefix+"open")){
        if(message.member.roles.cache.some(r => config.ids.permissionsid.mute.includes(r.id))) {
            let roleUpdate = message.guild.roles.cache.find(role => role.id === config.ids.rolesid.playerRole);

            message.channel.updateOverwrite(roleUpdate, { SEND_MESSAGES: true });
            message.reply("à ouvert le channel.")
        } else {
            message.delete()
        }
        return;
    } else if(message.content.startsWith(prefix+"help")){
        message.author.send("Voici les commandes disponibles sur le Discord de la communauté Zertrix : \n"+
                            "--------------------------------------------------------------- \n"+
                            "**"+prefix+"clear** => Clear un channel. (Tout Channel & Staff).\n"+
                            "**"+prefix+"close** => Fermer un channel (Tout Channel & Staff).\n"+
                            "**"+prefix+"open** => Ouvrir un channel (Tout Channel & Staff).\n"+
                            "**"+prefix+"ban** *<Tag Un Joueur>* *<Raison>* => Bannir un joueur. (Staff)\n"+
                            "**"+prefix+"kick** *<Tag Un Joueur>* *<Raison>* => Exclure un joueur.(Staff)\n"+
                            "**"+prefix+"mute** *<Tag Un Joueur>* *<Voice|Chat|ALL>* *<Raison>* => Rendre un joueur muet.(Staff)\n"+
                            "**"+prefix+"warn** *<Tag Un Joueur>* *<Raison>* => Avertir un joueur.(Staff)\n"+
                            "**"+prefix+"unban** *<Tag Un Joueur>* => Révoquer le banissement d'un joueur.(Staff)\n"+
                            "**"+prefix+"unmute** *<Tag Un Joueur>* => Démuter un joueur.(Staff)\n"+
                            "**"+prefix+"cv** *<Tag Un Joueur>* => Obtenir l'historique de modération d'un joueur.(Staff)\n"+
                            "**"+prefix+"old** *<Tag Un Joueur>* <Nombre De Message> => Obtenir l'historique des messages d'un joueur.(Staff)\n"+
                            "**"+prefix+"ping** => Obtenir la latence entre vous et le server.\n"+
                            "**"+prefix+"report** *<Tag Un Joueur>* => Reporter un joueur.\n"+
                            "**"+prefix+"play** *<Titre>* => Jouer une musique.\n"+
                            "**"+prefix+"stop** => Arreter une musique.\n"+
                            "**"+prefix+"skip** => Passer une musique.\n"+
                            "**"+prefix+"ticket** => En cas de probleme, ouvrir un ticket avec le staff.\n"
                            )
        return;
    }

    //Check bot chan
    if(message.content[0] == prefix) {
        if(message.channel.id != config.ids.channelsid.botCmdChannel) {
            message.delete()
            message.member.send(config.motd.wrongBotChannel)
            return;
        }

        //#region COMMANDS FUNCTIONS
        async function ping()
        {
            message.react(config.motd.PositivReaction);

            let botmsg = await message.channel.send("🔺 Pinging")
            const embed = new Discord.MessageEmbed()
                .setColor("#FA8072")
                .setThumbnail("https://img2.freepng.fr/20180320/suq/kisspng-wi-fi-alliance-logo-internet-wifi-modem-icon-5ab0c69c1e7634.5561903815215346201248.jpg")
                .setTitle("Ping :")
                .setURL("https://www.speedtest.net/")
                .setTimestamp(message.createdTimestamp)
                .addField(
                    "Bots Ping",
                    `${Math.round(botmsg.createdAt - message.createdAt)} ms.`
                )
                .addField( "API Ping", `${Math.round(Client.ws.ping)} ms.`)
                .setFooter(
                    `Demandé par : ${message.author.tag}`,
                    message.author.avatarURL()
                )
            botmsg.edit(" ", embed)
        }
        function ticket()
        {
            db.query('SELECT * FROM `tickets` WHERE 1', function (error, results, fields) {
                message.channel.send(config.motd.openTickets)
                const TicketNumber = results.length;
                let category = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.ticketCat)

                Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.create('Ticket #'+TicketNumber, { type: 'text' }).then(channel => {
                    channel.setParent(category.id)
                    
                    let rolePlayer = message.guild.roles.cache.find(role => role.id === config.ids.rolesid.playerRole);
                    channel.updateOverwrite(message.author, { VIEW_CHANNEL: true });
                    channel.updateOverwrite(rolePlayer, { VIEW_CHANNEL: false });


                    var post  = {opened: message.author.id, channelid: channel.id};
                    var query = db.query('INSERT INTO tickets SET ?', post)

                    channel.send(config.motd.TicketChanOpen).then((message) => {
                        message.react("🔒")
                    })
                })
            });
        }
        function ban()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.ban.includes(r.id))) {
                let mention = message.mentions.members.first();
                if(checkMention(message, mention)) {
                    if(mention.bannable){
                        const reason = message.content.slice(prefix.length).trim().replace("ban", "").replace("<@!"+mention.id+">", "");
                        if(checkReason(message,reason)) {
                            var post  = {banned: mention.id, banner: message.author.id, reason: reason};
                            var query = db.query('INSERT INTO bans SET ?', post, function (error, results, fields) {
                                if (error) throw error;
                            });
                            message.react(config.motd.PositivReaction);
                            mention.ban();
                            message.channel.send("** " + mention.displayName+ " ** à été banni par ** "+ message.member.displayName +" ** : "+reason)
                        }
                    }
                    else {
                        message.reply(config.motd.cantBan)
                    }
                }
            }
        }
        function unban()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.ban.includes(r.id))) {
                let mention = message.mentions.members.first();
                if(checkMention(message, mention)) {
                    message.react(config.motd.PositivReaction);
                    message.guild.members.unban(mention.id)
                    message.channel.send("** " + mention.displayName+ " ** à été débanni par ** "+ message.member.displayName +" **")
                }
            }
        }
        function kick()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.kick.includes(r.id))) {
                let mention = message.mentions.members.first();
                if(checkMention(message,mention)) {
                    if(mention.kickable){
                        const reason = message.content.slice(prefix.length).trim().replace("kick", "").replace("<@!"+mention.id+">", "");
                        if(checkReason(message,reason)) {
                            var post  = {kicked: mention.id, kicker: message.author.id, reason: reason};
                            var query = db.query('INSERT INTO kicks SET ?', post, function (error, results, fields) {
                                if (error) throw error;
                            });

                            message.react(config.motd.PositivReaction);
                            mention.kick();
                            message.channel.send("** " +mention.displayName+ " ** à été exclu par ** "+ message.member.displayName + " ** : "+reason)
                        }
                    }
                    else {
                        message.reply(config.motd.cantKick)
                    }
                }
            }
        }
        function mute()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.mute.includes(r.id))) {
                let mention = message.mentions.members.first(); 

                if(checkMention(message, mention)) {
                    const args = message.content.slice(prefix.length).trim().split(" ");
                    const reason = args.joinReason(" ", 3);
                    if(args[2] == "all" || args[2] == "voice" || args[2] == "chat") args.joinReason(" ", 4);

                    if(!checkReason(message,reason)) { return; }
                    
                    if(args[2] == "all"){    
                        //mute voice
                        mention.roles.add(config.ids.rolesid.voiceMuteRole).then(mbr => {
                        //mute chat
                            mention.roles.add(config.ids.rolesid.muteChatRole).then(mbr => {
                                message.react(config.motd.PositivReaction);
                                message.reply(mention.displayName+" a été rendu muet vocal et chat par "+  message.member.displayName)
                            }).catch((err) => {
                                message.react(config.motd.negativReaction);
                                console.log(err)
                            });

                        }).catch((err) => {
                            message.react(config.motd.negativReaction);
                        });  
                    } else if(args[2] == "voice"){
                        //mute voice
                        mention.roles.add(config.ids.rolesid.voiceMuteRole).then(mbr => {
                            message.react(config.motd.PositivReaction);
                            message.reply(mention.displayName+" a été rendu muet vocal par "+  message.member.displayName)
                        }).catch((err) => {
                            message.react(config.motd.negativReaction);
                        });  
                    } else if(args[2] == "chat"){
                        //mute voice
                        mention.roles.add(config.ids.rolesid.muteChatRole).then(mbr => {
                            message.react(config.motd.PositivReaction);
                            message.reply(mention.displayName+" a été rendu muet chat par "+  message.member.displayName)
                        }).catch((err) => {
                            message.react(config.motd.negativReaction);
                        });  
                    } else {
                        message.reply(config.motd.enterTypeMute)
                        message.react(config.motd.negativReaction);
                        return;
                    }
                    var post  = {muted: mention.id, muter: message.author.id, type: args[2], reason: reason};
                    var query = db.query('INSERT INTO mutes SET ?', post, function (error, results, fields) {
                        if (error) throw error;
                    });
                }
            }
        }
        function unmute()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.mute.includes(r.id))) {
                let mention = message.mentions.members.first();
                if(checkMention(message, mention)) {
                    //Unmute voice
                    mention.roles.remove(config.ids.rolesid.voiceMuteRole).then(mbr => {
                    //UNmute chat
                        mention.roles.remove(config.ids.rolesid.muteChatRole).then(mbr => {
                            message.react(config.motd.PositivReaction);
                            message.reply(mention.displayName+" a été démute vocal et chat par "+  message.member.displayName)
                        }).catch((err) => {
                            message.react(config.motd.negativReaction);
                            console.log(err)
                        });

                    }).catch((err) => {
                        message.react(config.motd.negativReaction);
                    });  
                }
            }
        }
        function warn()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.warn.includes(r.id))) {
                let mention = message.mentions.members;
                if(checkMention(message, mention)) {

                    const reason = message.content.slice(prefix.length).trim().replace("warn", "").replace("<@!"+mention.first().id+">", "");
                    if(checkReason(message,reason)) {
                        var post  = {warned: mention.first().id, warner: message.author.id, reason: reason};
                        var query = db.query('INSERT INTO warns SET ?', post, function (error, results, fields) {
                            if (error) throw error;
                        });
                        message.react(config.motd.PositivReaction);

                        db.query('SELECT * FROM `warns` WHERE `warned` = '+ mention.first().id, function (error, results, fields) {
                            if(error) throw error;
                            if(results.length > 2){
                                message.channel.send("❗ **"+mention.first().displayName+"** a été banni par **"+  message.member.displayName + "** en raison de ses warns ❗")
                                mention.first().ban()

                                db.query('DELETE FROM `warns` WHERE `warned` = '+ mention.first().id, function (error, results, fields) {
                                    if(error) throw error;
                                });

                                return;
                            }
                        });

                        message.channel.send("❗ "+mention.first().displayName+" a été warn par "+  message.member.displayName + " : "+ reason+ "❗")
                    }
                }
            }
        }
        function report()
        {
            let mentionR = message.mentions.members.first();
            if(checkMention(message, mention)) {
                const reason = message.content.slice(prefix.length).trim().replace("report", "").replace("<@!"+mentionR.id+">", "");
                if(checkReason(message,reason)) {
                    const chan = Client.channels.cache.find(channel => channel.id === config.ids.channelsid.reportChan)
                    chan.send("**"+message.member.displayName+"** à report : **"+mentionR.displayName+"** pour : **"+reason+"** \n ")

                    var post  = {reported: mentionR.id, reporter: message.author.id, reason: reason};
                    var query = db.query('INSERT INTO reports SET ?', post, function (error, results, fields) {
                        if (error) throw error;
                    });

                    message.react(config.motd.PositivReaction);
                    message.reply(config.motd.reportTaken)
                }
            }
        }
        function cv()
        {
            if(message.member.roles.cache.some(r => config.ids.permissionsid.cv.includes(r.id))) {
                let mention = message.mentions.members.first();
                if(checkMention(message, mention)) {
                    db.query('SELECT * FROM `warns` WHERE `warned` = '+ mention.id, function (error, resultsWarns, fields) {
                        if(error) throw error;
                        var warns = resultsWarns.length;
                        db.query('SELECT * FROM `mutes` WHERE `muted` = '+ mention.id, function (error, resultsMutes, fields) {
                            if(error) throw error;
                            var mutes = resultsMutes.length;
                            db.query('SELECT * FROM `reports` WHERE `reported` = '+ mention.id, function (error, resultsReports, fields) {
                                if(error) throw error;
                                var reports = resultsReports.length;
                                db.query('SELECT * FROM `kicks` WHERE `kicked` = '+ mention.id, function (error, resultsKicks, fields) {
                                    if(error) throw error;
                                    var kicks = resultsKicks.length;
                                    db.query('SELECT * FROM `bans` WHERE `banned` = '+ mention.id, function (error, resultsBans, fields) {
                                        if(error) throw error;
                                        var bans = resultsBans.length;
                                        message.member.send("--------------------------------------------------\nVoici le cv de **"+mention.displayName+"**\n--------------------------------------------------\nReports : **"+reports+"**\nWarns : **"+warns+"**\nMutes : **"+mutes+"**\nKicks : **"+kicks+"**\nBans : **"+bans+"**\n--------------------------------------------------")
                                    });
                                });
                            });
                        });
                    });
                }
            }
        }
        function old()
        {
            let mention = message.mentions.members.first();
            if(checkMention(message, mention)) {
                let count = 0;
                var oldCount = message.content.slice(prefix.length).trim().split(" ")[2];

                if (!parseInt(oldCount)) {
                    if(!oldCount || oldCount.replace(/ .*/,'') == "") {
                        oldCount = 30;
                    } else {
                        return  message.reply("Merci d'entre un nombre de message valide.")
                    }
                }

                if(oldCount > 30) {

                }

                db.query('SELECT * FROM `messages` WHERE `userid` = '+message.author.id, function (error, results, fields) {
                    if(error) throw err;
                    message.react(config.motd.PositivReaction)
                    message.author.send("Historique des messages de **"+mention.displayName+"** :")
                    results.forEach(element => {
                        if(count > 15) return;
                        message.author.send("**"+element.message+"**")
                        count++;
                    });
            });
            if(count < 0) {
                message.reply("Cet utilisateur n'as pas encore écrit de message.")
            }
            }
        }

        //#endregion COMMANDS FUNCTIONS

        if(message.content.toLowerCase().includes("ping") || message.content.toLowerCase().includes("pings")){
            ping()
        } else if(message.content.toLowerCase().includes("ticket") || message.content.toLowerCase().includes("tickets")){
            ticket()
        } else if(message.content.toLowerCase().includes("ban") || message.content.toLowerCase().includes("bans")){
            ban()
        } else if(message.content.toLowerCase().includes("unban") || message.content.toLowerCase().includes("unbans") || message.content.toLowerCase().includes("debans") || message.content.toLowerCase().includes("deban")){
            unban()
        } else if(message.content.toLowerCase().includes("kick") || message.content.toLowerCase().includes("kicks")){
            kick()
        } else if(message.content.toLowerCase().includes("mute") || message.content.toLowerCase().includes("mutes")){
            mute()
        } else if(message.content.toLowerCase().includes("unmute") || message.content.toLowerCase().includes("unmutes")){
            unmute()
        } else if(message.content.toLowerCase().includes("warn") || message.content.toLowerCase().includes("warns")){
            warn()
        } else if(message.content.toLowerCase().includes("report") || message.content.toLowerCase().includes("reports")){
            report()
        } else if(message.content.toLowerCase().includes("cv")){
            cv()
        } else if(message.content.toLowerCase().includes("old") || message.content.toLowerCase().includes("olds") || message.content.toLowerCase().includes("olds")){
            old()
        } else if(message.content.toLowerCase().includes("play")){
            SongsManager(message,serverQueue)
        } else if(message.content.toLowerCase().includes("skip") || message.content.toLowerCase().includes("skips")){
            skipMusic(message,serverQueue)
        } else if(message.content.toLowerCase().includes("stop") || message.content.toLowerCase().includes("stope") || message.content.toLowerCase().includes("stops")){
            stopMusic(message,serverQueue)
        }

    } else {
        let mention = message.mentions.members;
        msg = message.content;
        mention.forEach(element => {
            msg = msg.replace("<@!"+element.id+">", element.displayName)
        });
        if(msg.replace(/\s/g,'') != "") {
            var post  = {id: message.id, userid: message.author.id, userDisplay: message.member.displayName, message: msg};
            var query = db.query('INSERT INTO messages SET ?', post, function (error, results, fields) {
                if (error) throw error;
            });
        }
    }
});


//CHECK FUNCTIONS
function checkMention(message, mention){
    if(mention == undefined) {
        message.reply(config.motd.memberUndefinded)
        message.react(config.motd.negativReaction)
        return false;
    } else {
        return true;
    }
}
function checkReason(message,reason){
    if(reason.replace(/\s/g,'') == "") {
        message.reply(config.motd.enterReason)
        message.react(config.motd.negativReaction)
        return false;
    } else {
        return true;
    }
}

//DIVERS FUNCTIONS
Array.prototype.joinReason = function(seperator,start,end){
    if(!start) start = 0;
    if(!end) end = this.length - 1;
    end++;
    return this.slice(start,end).join(seperator);
};

//MUSIC FUNCTIONS
async function SongsManager(message, serverQueue){   
    let vc = message.member.voice.channel;
    const args = message.content.slice(prefix.length).trim().split(" ");
    if(!vc) {
        return message.channel.send(config.motd.MusicEnterChannel);
    } else {
        let result = await searcher.search(args.join(" ").replace("play", ""), { type: "video" })
        const sonngInfo = await ytdl.getInfo(result.first.url)

        const song = {
            title: sonngInfo.videoDetails.title,
            url: sonngInfo.videoDetails.video_url
        };

        if(!serverQueue){
            const queueConstructor = {
                txtChannel: message.channel,
                vChannel: vc,
                connection: null,
                songs: [],
                volume: 6,
                playing: true
            };
            queue.set(message.guild.id, queueConstructor)

            queueConstructor.songs.push(song)

            try {
                let connection = await vc.join();
                queueConstructor.connection = connection;
                playMusic(message.guild, queueConstructor.songs[0])
            } catch (error) {
                console.log(error)
                queue.delete(msg.guild.id)
                return message.channel.send(config.motd.cantJoinVC)
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send("**"+song.title+"** a bien été ajouté a la file d'attente.")
        }
    }
}

function playMusic(guild, song) {
    const serverQueue = queue.get(guild.id);
    if(!song) {
        serverQueue.vChannel.leave();
        queue.delete(guild.id);
        return;
    }
    serverQueue.txtChannel.send("Lancement de : **"+ song.title+"**")
    const dispatcher = serverQueue.connection.play(ytdl(song.url, {filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1<<25 }), {highWaterMark: 1})
        .on('finish', () => {
            serverQueue.songs.shift();
            playMusic(guild, serverQueue.songs[0]);
        })
}

function stopMusic(message, serverQueue){
    if(!message.member.voice.channel)
        return serverQueue.txtChannel.send(config.motd.MusicEnterChannel);
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function skipMusic(message, serverQueue){
    if(!message.member.voice.channel)
        return serverQueue.txtChannel.send(config.motd.MusicEnterChannel);
    if(!serverQueue)
        return serverQueue.txtChannel.send(config.motd.noMusic)
    serverQueue.connection.dispatcher.end();
}


Client.login("YOUR_TOKEN")