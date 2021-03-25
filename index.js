    //Bot Discord
    const Discord = require("discord.js");
    const Client = new Discord.Client;

    const pc = require("page-content");

    //config
    var config = require('./config.json');

    var voiceList = 0;

    //Music Player
    const ytdl = require('ytdl-core');
    const { YTSearcher } = require('ytsearcher');
    const searcher = new YTSearcher({
        key: config.mod.ytbSearch,
        revealkey: true,
    });
    const queue = new Map();

    const prefix = config.other.prefix;

    var channelCount = 0;
    var tempChan = []

    let invites;

    var games = []; 
    var morpion = [];

    //Mysql Db
    var mysql = require('mysql');

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

        Client.user.setActivity("!help\nRejoignez nous\nSur Discord: discord.gg/eCuxhSUjy7\nGmod: 65.21.30.122", { type: 'LISTENING' });

        Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).fetchInvites().then(inv => {
            invites = inv;
        })


        //UPDATE CHANS INFOS
        setInterval(() => {
            var guild = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId);
            //server count
            pc.parseFromURL("https://www.gametracker.com/server_info/65.21.30.122:27015/").then(res => {
                guild.channels.cache.get("705497184136855686").setName("🟢 Ouvert "+ res['text'].substring(res['text'].indexOf('current players')).replace("current players: ", "")[0]+ " / 32")
            });
            //Discor online
            var onlineCount = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.filter(member => member.presence.status !== "offline").size;
            guild.channels.cache.get("822055591031209986").setName("Discord : "+ onlineCount+" En ligne")
            //voice count
            guild.channels.cache.get("814940336727523399").setName("En Discussion : "+ voiceList)
            //membres en tt
            guild.channels.cache.find(channel => channel.id === config.ids.channelsid.discordCountChannel).setName(guild.memberCount+ " membres");
            
        }, 3*60*1000);

        //Store rules message in cache
        Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === config.ids.channelsid.reglementChan).messages.fetch(config.ids.channelsid.reglementMessage).then(message =>{
            console.log("Reglement Message bien ajouté au cache");
        }).catch(err => {
            console.log("Erreur pendant la sauveggarde du message reglement au cache : "+err);
        })

        //Store Eleve Gendarme message in cache
        Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id === "815325811954810920").messages.fetch("819232559073460234").then(message =>{
            console.log("Eleve Gendarme Message bien ajouté au cache");
        }).catch(err => {
            console.log("Erreur pendant la sauveggarde du message Eleve Gendarme au cache : "+err);
        })
    });

    Client.on("guildMemberAdd", async(member) => {
        member.guild.fetchInvites().then(gInvites => {

            const invite = gInvites.find(inv => !invites.get(inv.code) || invites.get(inv.code).uses < inv.uses);

            var post  = {invited: member.id, inviter: invite.inviter.id, code: invite.code};
            db.query('INSERT INTO invitation SET ?', post, function (error, results, fields) {

                db.query('SELECT * FROM `invitation` WHERE `inviter` = '+ invite.inviter.id, function (error, results, fields) {
                    const channel = Client.channels.cache.find(channel => channel.id == config.ids.channelsid.leftChan)
                    const memberInviter = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id === JSON.parse(JSON.stringify(results))[0]['inviter']);
                    
                    channel.send("`# Nouvel arrivant !                       `\n────────────────────────────\n:small_blue_diamond: Bienvenue à : **"+member.displayName+"**\n:small_blue_diamond: Invité par : **"+memberInviter.displayName+"**\n:small_blue_diamond: Nombre d'invitation(s) : **"+results.length+"**\n:small_blue_diamond: Lien d'invitation : **"+invite+"**\n:small_blue_diamond: Nombre de joueur sur le serveur : **"+member.guild.memberCount+"**\n────────────────────────────\n")

                })
            });
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
    });

    Client.on('voiceStateUpdate', (oldMember, newMember) => {
        let newUserChannel = newMember.channelID;
        let oldUserChannel = oldMember.channelID;
        if(newUserChannel && !oldUserChannel){
            voiceList++;
        } else if(!newUserChannel && oldUserChannel) {
            if(voiceList != 0){
                voiceList--;
            }
        }

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

    function checkMorpion(arr){
        if(arr[0][0] == arr[1][0] && arr[1][0] == arr[2][0] && arr[1][0] != ""){
            return arr[0][0];
        } else if(arr[0][1] == arr[1][1] && arr[1][1] == arr[2][1] && arr[1][1] != ""){
            return arr[0][1];
        } else if(arr[0][2] == arr[1][2] && arr[1][2] == arr[2][2] && arr[1][2] != ""){
            return arr[0][2];
        } else if(arr[0][0] == arr[0][1] && arr[0][1] == arr[0][2] && arr[0][1] != ""){
            return arr[0][0];
        } else if(arr[1][0] == arr[1][1] && arr[1][1] == arr[1][2] && arr[1][1] != ""){
            return arr[1][0];
        } else if(arr[2][0] == arr[2][1] && arr[2][1] == arr[2][2] && arr[2][1] != ""){
            return arr[2][0];
        } else if(arr[0][0] == arr[1][1] && arr[1][1] == arr[2][2] && arr[1][1] != ""){
            return arr[0][0];
        } else if(arr[0][2] == arr[1][1] && arr[1][1] == arr[2][0] && arr[1][1] != ""){
            return arr[0][2];
        } else {
            return false;
        }
    }

    function roundMorpion(joueur1id,joueur2id, channelid, msgid) {
        morpion.forEach((key, indexmp) => {
            if(key["key"] == channelid){
                var winner = checkMorpion(key["value"])
                    var topleft = "⬛"
                    var topmid= "⬛"
                    var topright= "⬛"
                    var midleft= "⬛"
                    var midmid= "⬛"
                    var midright= "⬛"
                    var botleft= "⬛"
                    var botmid= "⬛"
                    var botright= "⬛"
                    games.forEach((element, index) => {
                        if(element["key"] == channelid){

                            if(key["value"][0][0] == joueur1id)
                                topleft = "⭕"
                            if(key["value"][0][0] == joueur2id)
                                topleft = "❌"

                            if(key["value"][0][1] == joueur1id)
                                topmid = "⭕"
                            if(key["value"][0][1] == joueur2id)
                                topmid = "❌"
                                
                            if(key["value"][0][2] == joueur1id)
                                topright = "⭕"
                            if(key["value"][0][2] == joueur2id)
                                topright = "❌"

                            if(key["value"][1][0] == joueur1id)
                                midleft = "⭕"
                            if(key["value"][1][0] == joueur2id)
                                midleft = "❌"

                            if(key["value"][1][1] == joueur1id)
                                midmid = "⭕"
                            if(key["value"][1][1] == joueur2id)
                                midmid = "❌"
                            
                            if(key["value"][1][2] == joueur1id)
                                midright = "⭕"
                            if(key["value"][1][2] == joueur2id)
                                midright = "❌"

                            if(key["value"][2][0] == joueur1id)
                                botleft = "⭕"
                            if(key["value"][2][0] == joueur2id)
                                botleft = "❌"

                            if(key["value"][2][1] == joueur1id)
                                botmid = "⭕"
                            if(key["value"][2][1] == joueur2id)
                                botmid = "❌"

                            if(key["value"][2][2] == joueur1id)
                                botright = "⭕"
                            if(key["value"][2][2] == joueur2id)
                                botright = "❌"
                            
                            var to = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id == joueur1id).toString()
                            if(element["value"][5]){
                                to = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id == joueur2id).toString()
                            }

        
                            const embed = new Discord.MessageEmbed()
                                .setColor('#FFA500')
                                .setTitle("Morpion")
                                .setDescription("**C'est au tour de : "+to+"**\n")
                                .addFields(
                                    { name: Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id == joueur1id).displayName, value: "❌" },
                                    { name: Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id == joueur2id).displayName, value: "⭕" },
                                    { name: "Morpion", value: topleft+topmid+topright+"\n"+midleft+midmid+midright+"\n"+botleft+botmid+botright}
                                    )
                                .setTimestamp()
                    
                            Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id == channelid).messages.fetch(msgid).then((msg) => {
                                if(msg.reactions.resolve("🚀")){
                                    msg.reactions.resolve("🚀").users.remove(joueur1id);
                                    msg.reactions.resolve("🚀").users.remove(joueur2id);
                                    msg.reactions.resolve("🚀").users.remove("797938606705475584");

                                    msg.reactions.resolve("🔒").users.remove(joueur1id);
                                    msg.reactions.resolve("🔒").users.remove(joueur2id);
                                    msg.reactions.resolve("🔒").users.remove("797938606705475584");
                                }
                                msg.edit(embed).then((msg)=>{
                                    if(!key["value"][0][0])
                                        msg.react("↖️")
                                    if(!key["value"][0][1])
                                        msg.react("⬆️")
                                    if(!key["value"][0][2])
                                        msg.react("↗️")
                                    if(!key["value"][1][0])
                                        msg.react("⬅️")
                                    if(!key["value"][1][1])
                                        msg.react("🟦")
                                    if(!key["value"][1][2])
                                        msg.react("➡️")
                                    if(!key["value"][2][0])
                                        msg.react("↙️")
                                    if(!key["value"][2][1])
                                        msg.react("⬇️")
                                    if(!key["value"][2][2])
                                        msg.react("↘️")
                                })

                            })
                            if(winner){
                                var win= Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id === joueur2id)
                                if(winner == joueur1id){
                                    win = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).members.cache.find(member => member.id === joueur1id);
                                }
                                const embed = new Discord.MessageEmbed()
                                embed.setTitle(win.displayName+" A gagné.")
                                embed.setDescription("**BRAVO A "+win.toString()+"**\nRéagisez tous les deux avec 🚀 pour redémarrer une partie.\nSi vous ne souhaitez pas rejouer, réagissez avec : 🔒.\nDans 60 secondes, la partie se fermera automatiquement.")
                                embed.setTimestamp()
                                Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id == channelid).send(embed).then((msg) => {
                                    msg.react("🚀")
                                    msg.react("🔒")
                                })
                                morpion[indexmp] = null;
                                games[index] = null;

                                games.push({
                                    key:   channelid,
                                    value: ["morpion",null, null, joueur2id, joueur1id, true]
                                });

                                var interval = setInterval(() => {
                                    var chan = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id == chanid)
                                        if(chan){
                                            if(key["key"] == channel.id && (!key["value"][1] || !key["value"][2])) {
                                                games[key] = null;
                                                clearInterval(interval)
                                                channel.delete()
                                            }
                                        }
                                }, 60000);
                                
                            }
                        }
                        
                    });
            }
        });

    }

    Client.on("messageReactionAdd", (reaction, user) => {
        if(user.bot) return;
        games.forEach((key, index) => {
            if(key["key"] == reaction.message.channel.id){
                if(reaction.emoji.name == "🚀") {

                    if(key["value"][1] == true) {
                        games[index]['value'][2] = true;
                    } else {
                        games[index]['value'][1] = true;
                    }

                    if(key["value"][2] == true && key["value"][1] == true){
                        if(key["value"][0] == "morpion") {

                            morpion.push({
                                key:   reaction.message.channel.id,
                                value: [["","",""],
                                        ["","",""],
                                        ["","",""]]
                            });
                            roundMorpion(key["value"][3], key["value"][4],reaction.message.channel.id,reaction.message.id)
                        }
                    }
                } else if(reaction.emoji.name == "🔒"){
                    games[index] = null;
                    reaction.message.channel.delete()
                } else {
                    var done = false;
                    morpion.forEach((mpkey) => {
                        if(key["key"] == reaction.message.channel.id){
      
                            if((key["value"][5] == true && key["value"][4] == user.id) ||(key["value"][5] == false && key["value"][3] == user.id))
                            switch (reaction.emoji.name) {
                                case '↖️':
                                    done=true;
                                    mpkey["value"][0][0] = user.id;
                                    break;
                                case '⬆️':
                                    done=true;
                                    mpkey["value"][0][1] = user.id;
                                    break;
                                case '↗️':
                                    done=true;
                                    mpkey["value"][0][2] = user.id;
                                    break;
                                case '⬅️':
                                    done=true;
                                    mpkey["value"][1][0] = user.id;
                                    break;
                                case '🟦':
                                    done=true;
                                    mpkey["value"][1][1] = user.id;
                                    break;
                                case '➡️':
                                    done=true;
                                    mpkey["value"][1][2] = user.id;
                                    break;
                                case '↙️':
                                    done=true;
                                    mpkey["value"][2][0] = user.id;
                                    break;
                                case '⬇️':
                                    done=true;
                                    mpkey["value"][2][1] = user.id;
                                    break;
                                case '↘️':
                                    done=true;
                                    mpkey["value"][2][2] = user.id;
                                    break;
                            }                        
                        }
                        if(done) {
                            const chanId= reaction.message.channel.id
                            const msgId= reaction.message.id

                            if(key["key"] == reaction.message.channel.id){
                                games[index]["value"][5] = !key["value"][5];
                                roundMorpion(key["value"][3], key["value"][4],chanId,msgId)
                                reaction.message.reactions.resolve(reaction.emoji.name).users.remove(user.id);
                                reaction.message.reactions.resolve(reaction.emoji.name).users.remove("797938606705475584");
                            }

                        }
                    })
                }
            }


        })

        if(reaction.emoji.name == "✅" && reaction.message.id == config.ids.channelsid.reglementMessage) {
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
        } else if(reaction.emoji.name == "🚓" && reaction.message.id == "819232559073460234"){
            var member = reaction.message.guild.members.cache.find(member => member.id === user.id);

            member.roles.add("815325468601221161").then(mbr => {
                console.log("Eleve Gendarme add to "+ mbr.displayName);
            }).catch(err => {
                console.log("Elevegendarme: Le role n'as pas pu etre ajouté à : "+ err);
            })
        }
    });

    Client.on("messageReactionRemove", (reaction, user) => {
        if(user.bot) return;
        var member = reaction.message.guild.members.cache.find(member => member.id === user.id);

        if(reaction.emoji.name == "✅" && reaction.message.id == config.ids.channelsid.reglementMessage) {
            member.roles.add(config.ids.rolesid.defaultRole).then(mbr => {
                console.log("remove role added to "+ mbr.displayName);

                member.roles.remove(config.ids.rolesid.playerRole).then(mbr => {
                    console.log("Default role removed to "+ mbr.displayName);
                }).catch(err => {
                    console.log("Le role n'as pas pu etre retiré à: "+ err);
                })

            }).catch(err => {
                console.log("Le role n'as pas pu ajouté retiré : "+ err);
            })
        }  else if(reaction.emoji.name == "🚓" && reaction.message.id == "819232559073460234"){
            var member = reaction.message.guild.members.cache.find(member => member.id === user.id);

            member.roles.remove("815325468601221161").then(mbr => {
                console.log("Eleve Gendarme removed to "+ mbr.displayName);
            }).catch(err => {
                console.log("Elevegendarme: Le role n'as pas pu etre remove à : "+ err);
            })
        }
    })

    Client.on("message", message => {

        if(message.channel.id == "698546600305361066"){
            const voter = message.content.toLowerCase().replace(" vient de voter pour le serveur !","")

            db.query("SELECT * FROM users WHERE vote_name='"+voter+"'", function (error, results, fields) {
                if(results.length > 0){
                    var id = results[0]['id'];
                } else {
                    var id = "undefinded";
                }
                var post  = {username: voter.charAt(0).toUpperCase() + voter.slice(1), account_id: id};
                db.query('INSERT INTO votes SET ?', post)

            });
        }

        if(message.author.bot) return;

        //BOT CLAIM
        if(message.channel.type == "dm") {
            const mcontent = message.content.toLowerCase()
            if(!mcontent.includes("stop")) {

                db.query('SELECT * FROM `users` WHERE discord_id='+message.author.id, function (error, results, fields) {
                    if(results.length > 0) {
                        if(results[0]['status'] == "setting_steam"){
                            if(mcontent.includes("https://steamcommunity.com/id/")){
                                claimSteamId(mcontent.replace("https://steamcommunity.com/id/", "").replace("/","").replace(" ",""))
                            } else if(mcontent.includes("https://steamcommunity.com/profiles/")){
                                claimSteamId(mcontent.replace("https://steamcommunity.com/profiles/", "").replace("/","").replace(" ",""))
                            } else {
                                message.author.send("Lien steam Invalide.")
                                message.reply(config.motd.negativReaction)
                            }
                        } else if(results[0]['status'] == "setting_vote"){
                            db.query("SELECT * FROM `users` WHERE vote_name='"+mcontent+"'", function (error, results, fields) {
                                if(results.length == 0){
                                    db.query("UPDATE users SET status = 'closed', vote_name='"+mcontent+"' WHERE discord_id="+message.author.id)
                                    message.author.send("Merci, Vous recevrez donc 500$ in game a chaque vote\nMerci.")
                                } else {
                                    message.author.send("Ce Pseudo de vote est déja utilisé.")
                                }
                            })
                        }
                    } 
                })
            } else {
                db.query("UPDATE users SET status = 'unfinished' WHERE discord_id="+message.author.id)  
            }
            return;
        }

        //////API ID STEAMMM
        function claimSteamId(id,custom){
            if(id){
                db.query("UPDATE users SET status = 'setting_vote', steam_id='"+id+"' WHERE discord_id="+message.author.id)
                message.author.send("Une derniere étape, entrez le pseudo avec lequel vous votez.\nEn cas d'erreur, envoyer 'Stop'.")
            } else {
                message.author.send("Merci de mettre le lien de ton profil steam.\nEn cas d'erreur, envoyer 'Stop'.")
            }
        }

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
                message.reply("a ouvert le channel.")
            } else {
                message.delete()
            }
            return;
        } else if(message.content.startsWith(prefix+"help")){
            if(message.channel.id != config.ids.channelsid.botCmdChannel) {
                message.delete()
            } else {
                message.react(config.motd.PositivReaction)
            }
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
                    db.query('INSERT INTO tickets SET ?', post)

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
                                db.query('INSERT INTO bans SET ?', post, function (error, results, fields) {
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
                                db.query('INSERT INTO kicks SET ?', post, function (error, results, fields) {
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
                        db.query('INSERT INTO mutes SET ?', post, function (error, results, fields) {
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
                            db.query('INSERT INTO warns SET ?', post, function (error, results, fields) {
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
                        db.query('INSERT INTO reports SET ?', post, function (error, results, fields) {
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

                                            const embed = new Discord.MessageEmbed()
                                            .setColor('#FFA500')
                                            .setTitle("Statistiques")
                                            .setDescription("Voici les statistiques de :**"+mention.displayName+"**")
                                            .setThumbnail('https://i.imgur.com/N8VzoHc.png')
                                            .addFields(
                                                { name: 'Reports :', value: reports },
                                                { name: 'Warns :', value: warns },
                                                { name: 'Mutes :', value: mutes },
                                                { name: 'Kicks :', value: kicks },
                                                { name: 'Bans :', value: bans },
                                            )
                                            .setTimestamp()
                                            .setFooter("Bonne continuation Sur Zertrix.");
                                
                                            message.member.send(embed);
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
            function claim() {   
                db.query("SELECT * FROM users WHERE discord_id='"+message.member.id+"'", post, function (error, results, fields) {
                    if(results.length > 0){
                        db.query("UPDATE users SET status='setting_steam', steam_id='undefinded', vote_name='undefinded' WHERE discord_id="+message.author.id)
                    } else {
                        var post  = {discord_id: message.member.id};
                        db.query('INSERT INTO users SET ?', post)
                    }
                });

                const embed = new Discord.MessageEmbed()
                embed.addField("Bonjour"+message.member.displayName+", Merci de mettre le lien de ton profil steam.", "[Disponible ici.](https://steamcommunity.com/login)  En cas d'erreur, envoyer 'stop'");
                message.author.send(embed)
                message.react(config.motd.PositivReaction)
            }

            function duel() {   
                let mention = message.mentions.members.first();
                const game = message.content.slice(prefix.length).trim().replace("duel", "").replace("<@!"+mention.id+">", "").replace(/\s/g,'');
                if(checkMention(message, mention) && game == "morpion") {

                    message.react(config.motd.PositivReaction)

                    Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.create('Morpion-#'+morpion.length, { type: 'text' }).then(channel => {
                        channel.setParent("823282116959273001")
                        
                        let rolePlayer = message.guild.roles.cache.find(role => role.id === config.ids.rolesid.playerRole);

                        channel.updateOverwrite(message.author.id, { VIEW_CHANNEL: true , SEND_MESSAGES: false, ADD_REACTIONS:false});
                        channel.updateOverwrite(rolePlayer.id, { VIEW_CHANNEL: false , SEND_MESSAGES: false});
                        channel.updateOverwrite(mention.id, { VIEW_CHANNEL: true, SEND_MESSAGES: false, ADD_REACTIONS:false});


                        games.push({
                            key:   channel.id,
                            value: ["morpion",null, null, message.member.id, mention.id, true]
                        });

                        const embed = new Discord.MessageEmbed()
                        embed.setTitle(mention.displayName+" , "+message.member.displayName+" vous a défier au morpion.")
                        embed.setDescription("Réagisez tous les deux avec 🚀 pour démarrer la partie.\nSi vous ne souhaitez pas jouer, réagissez avec : 🔒.\nDans 60 secondes, la partie se fermera automatiquement.\n"+mention.toString()+", "+message.member.toString())
                        embed.setTimestamp()
                        channel.send(embed).then((msg) => {
                            msg.react("🚀")
                            msg.react("🔒")
                        })
                        var chanid = channel.id;

                        var interval = setInterval(() => {
                            games.forEach((key) => {
                                var chan = Client.guilds.cache.find(guild => guild.id == config.ids.channelsid.serverId).channels.cache.find(channel => channel.id == chanid)
                                if(chan){
                                    if(key["key"] == channel.id && (!key["value"][1] || !key["value"][2])) {
                                        games[key] = null;
                                        clearInterval(interval)
                                        channel.delete()
                                    }
                                }
                            })
                        }, 60000);

                    })
                } else {
                    message.reply("!duel <@Joueur> Morpion")
                    message.react(config.motd.negativReaction)
                }
            }

            //#endregion COMMANDS FUNCTIONS

            const mcontent = message.content.toLowerCase()
            if(mcontent.includes("ping") || mcontent.includes("pings")){
                ping()
            } else if(mcontent.includes("ticket") || mcontent.includes("tickets")){
                ticket()
            } else if(mcontent.includes("ban") || mcontent.includes("bans")){
                ban()
            } else if(mcontent.includes("unban") || mcontent.includes("unbans") || mcontent.includes("debans") || mcontent.includes("deban")){
                unban()
            } else if(mcontent.includes("kick") || mcontent.includes("kicks")){
                kick()
            } else if(mcontent.includes("mute") || mcontent.includes("mutes")){
                mute()
            } else if(mcontent.includes("unmute") || mcontent.includes("unmutes")){
                unmute()
            } else if(mcontent.includes("warn") || mcontent.includes("warns")){
                warn()
            } else if(mcontent.includes("report") || mcontent.includes("reports")){
                report()
            } else if(mcontent.includes("cv")){
                cv()
            } else if(mcontent.includes("old") || mcontent.includes("olds") || mcontent.includes("olds")){
                old()
            } else if(mcontent.includes("claim") || mcontent.includes("reward") || mcontent.includes("rewards")){
                claim()
            } else if(mcontent.includes("play")){
                SongsManager(message,serverQueue)
            } else if(mcontent.includes("skip") || mcontent.includes("skips")){
                skipMusic(message,serverQueue)
            } else if(mcontent.includes("stop") || mcontent.includes("stope") || mcontent.includes("stops")){
                stopMusic(message,serverQueue)
            } else if(mcontent.includes("duel")) {
                duel()
            }

        } else {
            let mention = message.mentions.members;
            msg = message.content;
            mention.forEach(element => {
                msg = msg.replace("<@!"+element.id+">", element.displayName)
            });
            if(msg.replace(/\s/g,'') != "") {
                var post  = {id: message.id, userid: message.author.id, userDisplay: message.member.displayName, message: unescape(encodeURIComponent(msg))};
                db.query('INSERT INTO messages SET ?', post, function (error, results, fields) {
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


    Client.login(config.mod.key)
