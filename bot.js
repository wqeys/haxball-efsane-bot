// Haxball Headless Host için - www.haxball.com/headless
var room = HBInit({
    roomName: "ODA İSMİNİ GİR",
    maxPlayers: 19,
    public: true,
    noPlayer: true,
    geo: { "code": "TR", "lat": 41.01384, "lon": 28.94966 },
});

// ============================================
// AYARLAR
// ============================================
const OWNER_AUTH = "BDJ_hdu9wSW4qxeZ5Jl5NUj8_uvi5E-OEykZGK79Kks"; // Kurucu auth ID'si

const MIN_SIZE = 5;   // Minimum oyuncu boyutu
const MAX_SIZE = 40;  // Admin olmayanlar için maksimum oyuncu boyutu
const DEFAULT_SIZE = 15;

room.setDefaultStadium("Classic");
room.setScoreLimit(3);
room.setTimeLimit(3);
room.setTeamsLock(true);

// ============================================
// DEĞİŞKENLER
// ============================================
var playerSizes = {};              // Her oyuncunun mevcut boyutu {playerId: size}
var teamSizes = {red: DEFAULT_SIZE, blue: DEFAULT_SIZE};
var ballSize = 10;
var playerAuths = {};              // {playerId: auth}
var sizeChangeEnabled = true;      // Admin olmayanların !size [değer] komutunu kullanabilmesi

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================
function isOwner(player) {
    return playerAuths[player.id] === OWNER_AUTH;
}

// Artık "admin" = kurucu VEYA kurucunun admin yaptığı herkes.
// Oyun içi admin durumu (player.admin) referans alınır.
function isAdmin(player) {
    return player.admin === true || isOwner(player);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Kurucu odada olduğu sürece admin olduğundan emin ol.
// Başkalarının adminliğine burada dokunulmuyor; onu kurucu kendi elleriyle yönetir.
function ensureOwnerAdmin() {
    var players = room.getPlayerList();
    for (var i = 0; i < players.length; i++) {
        if (playerAuths[players[i].id] === OWNER_AUTH && !players[i].admin) {
            room.setPlayerAdmin(players[i].id, true);
        }
    }
}

// ============================================
// BOYUT SİSTEMİ
// ============================================

// !size [değer]           -> herkes kendi boyutunu değiştirir (5-40 arası, açık olduğu sürece)
// !size aç / !size kapa   -> sadece admin, herkes için boyut değiştirmeyi açar/kapatır
// !size [id] [değer]      -> sadece admin, hedef oyuncunun boyutu (sınırsız)
// !size all [değer]       -> sadece admin, herkesin boyutu (sınırsız)
// !size red/blue [değer]  -> sadece admin, takım boyutu (sınırsız)
// !size top [değer]       -> sadece admin, top boyutu (sınırsız)
function changeSize(player, message) {
    var parts = message.trim().split(" ");

    // Sadece "!size" -> kullanım bilgisi
    if (parts.length === 1) {
        room.sendAnnouncement("Kullanım: !size [değer] (" + MIN_SIZE + "-" + MAX_SIZE + ")", player.id, 0xFFFF00, "bold", 1);
        return;
    }

    var admin = isAdmin(player);
    var target = parts[1].toLowerCase();

    // ---- ADMİN YETKİLİ KOMUTLAR ----
    if (admin && parts.length === 2 && (target === "aç" || target === "ac")) {
        sizeChangeEnabled = true;
        room.sendAnnouncement("🔓 Boyut değiştirme (!size) herkes için açıldı!", null, 0x66ff00, "bold", 2);
        return;
    }

    if (admin && parts.length === 2 && target === "kapa") {
        sizeChangeEnabled = false;
        room.sendAnnouncement("🔒 Boyut değiştirme (!size) herkes için kapatıldı!", null, 0xff2400, "bold", 2);
        return;
    }

    if (admin && parts.length === 3 && target === "top") {
        var size = parseFloat(parts[2]);
        if (isNaN(size) || size <= 0) {
            room.sendAnnouncement("⚠️ Geçersiz top boyutu!", player.id, 0xff2400, "bold", 1);
            return;
        }
        ballSize = size;
        room.setDiscProperties(0, {radius: size});
        room.sendAnnouncement("⚽ Top boyutu güncellendi: " + size, null, 0xFFFF00, "bold", 2);
        return;
    }

    if (admin && parts.length === 3 && target === "all") {
        var size = parseFloat(parts[2]);
        if (isNaN(size) || size < 0) {
            room.sendAnnouncement("⚠️ Geçersiz boyut değeri!", player.id, 0xff2400, "bold", 1);
            return;
        }
        // teamSizes güncelle — bundan sonra katılacaklar da bu değeri alır
        teamSizes.red = size;
        teamSizes.blue = size;
        var allPlayers = room.getPlayerList();
        for (var i = 0; i < allPlayers.length; i++) {
            // Spectator dahil odadaki herkesin playerSizes kaydını güncelle
            playerSizes[allPlayers[i].id] = size;
            // Disc sadece takımdaki oyuncular için geçerli (spectator disc'i yok)
            if (allPlayers[i].team !== 0) {
                room.setPlayerDiscProperties(allPlayers[i].id, {radius: size});
            }
        }
        room.sendAnnouncement("👥 Tüm oyuncuların boyutu güncellendi: " + size, null, 0x66ff00, "bold", 2);
        return;
    }

    if (admin && parts.length === 3 && (target === "red" || target === "blue")) {
        var size = parseFloat(parts[2]);
        if (isNaN(size) || size < 0) {
            room.sendAnnouncement("⚠️ Geçersiz boyut değeri!", player.id, 0xff2400, "bold", 1);
            return;
        }
        var team = target === "red" ? 1 : 2;
        if (team === 1) teamSizes.red = size; else teamSizes.blue = size;
        var allPlayers = room.getPlayerList();
        for (var i = 0; i < allPlayers.length; i++) {
            if (allPlayers[i].team === team) {
                room.setPlayerDiscProperties(allPlayers[i].id, {radius: size});
                playerSizes[allPlayers[i].id] = size;
            }
        }
        var color = team === 1 ? 0xFF0000 : 0x0000FF;
        var teamName = team === 1 ? "Kırmızı" : "Mavi";
        room.sendAnnouncement("⚽ " + teamName + " takım boyutu güncellendi: " + size, null, color, "bold", 2);
        return;
    }

    if (admin && parts.length === 3 && !isNaN(parseInt(parts[1]))) {
        var targetId = parseInt(parts[1]);
        var size = parseFloat(parts[2]);
        var targetPlayer = room.getPlayer(targetId);
        if (!targetPlayer) {
            room.sendAnnouncement("⚠️ ID " + targetId + " bulunamadı!", player.id, 0xff2400, "bold", 1);
            return;
        }
        if (isNaN(size) || size < 0) {
            room.sendAnnouncement("⚠️ Geçersiz boyut değeri!", player.id, 0xff2400, "bold", 1);
            return;
        }
        room.setPlayerDiscProperties(targetId, {radius: size});
        playerSizes[targetId] = size;
        room.sendAnnouncement("✅ " + targetPlayer.name + " boyutu " + size + " olarak değiştirildi!", player.id, 0x66ff00, "bold", 1);
        return;
    }

    // ---- HERKESE AÇIK: KENDİ BOYUTUNU DEĞİŞTİRME ----
    if (parts.length === 2) {
        if (!admin && !sizeChangeEnabled) {
            room.sendAnnouncement("🔒 Boyut değiştirme şu anda kapalı!", player.id, 0xff2400, "bold", 1);
            return;
        }
        var size = parseFloat(parts[1]);
        if (isNaN(size)) {
            room.sendAnnouncement("⚠️ Geçersiz boyut değeri!", player.id, 0xff2400, "bold", 1);
            return;
        }
        var clamped = admin ? size : clamp(size, MIN_SIZE, MAX_SIZE);
        if (!admin && (size < MIN_SIZE || size > MAX_SIZE)) {
            room.sendAnnouncement("⚠️ Boyut " + MIN_SIZE + " ile " + MAX_SIZE + " arasında olmalı!", player.id, 0xff2400, "bold", 1);
            return;
        }
        room.setPlayerDiscProperties(player.id, {radius: clamped});
        playerSizes[player.id] = clamped;
        room.sendAnnouncement("✅ Boyutunuz değiştirildi: " + clamped, player.id, 0x66ff00, "bold", 1);
        return;
    }

    room.sendAnnouncement("⚠️ Geçersiz kullanım! !komutlar yazarak yardım alabilirsin.", player.id, 0xff2400, "bold", 1);
}

// Gol atıldığında da tüm boyutları kaydedilen (playerSizes) değerlere göre yeniden uygula
function reapplyAllSizes() {
    for (var playerId in playerSizes) {
        room.setPlayerDiscProperties(parseInt(playerId), {radius: playerSizes[playerId]});
    }
    room.setDiscProperties(0, {radius: ballSize});
}

// ============================================
// KOMUTLAR LİSTESİ
// ============================================
function helpFun(player) {
    var admin = isAdmin(player);

    room.sendAnnouncement("━━━━━━━━━━ 📋 KOMUTLAR 📋 ━━━━━━━━━━", player.id, 0xFFFF00, "bold", 2);
    room.sendAnnouncement("!size [değer] - Kendi boyutunu değiştir (" + MIN_SIZE + "-" + MAX_SIZE + ")", player.id, 0xFFFFFF, "normal", 1);

    if (admin) {
        room.sendAnnouncement("!size aç / !size kapa - Herkes için boyut değiştirmeyi aç/kapa", player.id, 0x74F9FF, "normal", 1);
        room.sendAnnouncement("!size [id] [değer] - Bir oyuncunun boyutunu değiştir", player.id, 0x74F9FF, "normal", 1);
        room.sendAnnouncement("!size all [değer] - Tüm oyuncuların boyutunu değiştir", player.id, 0x74F9FF, "normal", 1);
        room.sendAnnouncement("!size red/blue [değer] - Takım boyutunu değiştir", player.id, 0x74F9FF, "normal", 1);
        room.sendAnnouncement("!size top [değer] - Top boyutunu değiştir", player.id, 0x74F9FF, "normal", 1);
    }

    room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", player.id, 0xFFFF00, "bold", 2);
}

var commands = {
    "!komutlar": helpFun,
    "!size": changeSize
};

// ============================================
// EVENT'LER
// ============================================
room.onPlayerChat = function(player, message) {
    if (message.charAt(0) !== "!") return true; // Normal mesajlar için Haxball'ın varsayılan davranışı

    var spacePos = message.indexOf(" ");
    var command = message.substring(0, spacePos !== -1 ? spacePos : message.length);

    if (commands[command]) {
        commands[command](player, message);
    } else {
        room.sendAnnouncement("Komut bulunamadı! !komutlar yaz", player.id, 0xff2400, "bold", 1);
    }
    return false;
};

room.onPlayerJoin = function(player) {
    playerAuths[player.id] = player.auth;
    // Not: playerSizes burada BİLİNÇLİ olarak atanmıyor. Oyuncu bir takıma
    // katıldığında onPlayerTeamChange, en son ayarlanan !size all / red / blue
    // değerini (teamSizes) otomatik olarak uygular. Böylece "!size all 10"
    // yazıldıktan sonra katılan biri de 15 değil, 10 ile başlar.
    ensureOwnerAdmin();

    room.sendAnnouncement("👋 " + player.name + " odaya katıldı!", null, 0xFFD700, "bold", 2);

    // Yeni gelen oyuncuya komutları göster
    setTimeout(function() {
        var stillThere = room.getPlayer(player.id);
        if (!stillThere) return;
        room.sendAnnouncement("━━━━━━ 🎮 HOŞ GELDİN 🎮 ━━━━━━", player.id, 0x00FF00, "bold", 2);
        room.sendAnnouncement("!size [değer] yazarak kendi boyutunu ayarlayabilirsin (" + MIN_SIZE + "-" + MAX_SIZE + ")", player.id, 0xFFFFFF, "normal", 1);
        room.sendAnnouncement("Tüm komutlar için: !komutlar", player.id, 0xFFFFFF, "normal", 1);
        room.sendAnnouncement("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", player.id, 0x00FF00, "bold", 2);
    }, 1000);
};

room.onPlayerLeave = function(player) {
    delete playerAuths[player.id];
    delete playerSizes[player.id];
    ensureOwnerAdmin();
};

room.onPlayerTeamChange = function(changedPlayer) {
    // changedPlayer.team event anında eski takımı gösterebilir.
    // room.getPlayer() ile güncel takım bilgisini alıyoruz.
    var playerId = changedPlayer.id;
    setTimeout(function() {
        var p = room.getPlayer(playerId);
        if (!p) return;

        // Oyuncunun daha önce kendisi ayarladığı özel bir boyutu varsa onu koru.
        // Yoksa o anki takımın en son ayarlanan boyutunu (teamSizes) kullan.
        var targetSize = playerSizes[playerId];
        if (targetSize === undefined) {
            if (p.team === 1)      targetSize = teamSizes.red;
            else if (p.team === 2) targetSize = teamSizes.blue;
            else                   targetSize = DEFAULT_SIZE;
        }

        room.setPlayerDiscProperties(playerId, {radius: targetSize});
        playerSizes[playerId] = targetSize;
    }, 100);
};

room.onPositionsReset = function() {
    reapplyAllSizes();
};

// Gol atıldığında (kickoff'tan önce) boyutları garantiye almak için ekstra tetikleyici
room.onTeamGoal = function(team) {
    setTimeout(function() {
        reapplyAllSizes();
    }, 50);
};

room.onGameStart = function(byPlayer) {
    setTimeout(function() {
        reapplyAllSizes();
    }, 50);
};

// Kurucunun adminliği asla elinden alınamaz.
// Başkaları admin yapıldığında veya adminlikten alındığında bota dokunulmaz;
// bu artık tamamen admin yetkisi olan kişilerin (haxball'ın kendi admin panelinden) elinde.
room.onPlayerAdminChange = function(changedPlayer, byPlayer) {
    if (playerAuths[changedPlayer.id] === OWNER_AUTH && !changedPlayer.admin) {
        setTimeout(function() {
            room.setPlayerAdmin(changedPlayer.id, true);
        }, 50);
    }
};

room.onRoomLink = function(link) {
    console.log("Oda linki: " + link);
};
