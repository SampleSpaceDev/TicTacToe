const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Keep track of all active games
const games = {};

// Serve static files from the public directory
app.use(express.static('public'));

// Handle new socket connections
io.on('connection', socket => {
    // When a player joins a game
    socket.on('join', () => {
        joinGame(socket);
    });

    // When a player makes a move
    socket.on('move', ({ gameID, index }) => {
        const game = games[gameID];
        if (game) {
            // Update the game state
            game.state[index] = game.turn % 2 === 0 ? 'X' : 'O';
            game.turn++;
            checkWin(game);
            // Broadcast the new state to the other player
            socket.broadcast.to(gameID).emit('state', game.state, game.turn, game.winner);
        }
    });

    // When a player disconnects
    socket.on('disconnect', () => {
        // Remove the player from any games they were in
        for (const gameID in games) {
            const game = games[gameID];
            const playerIndex = game.players.indexOf(socket);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                socket.leave(gameID);
                if (game.players.length === 0) {
                    // If no players are in the game, delete the game
                    delete games[gameID];
                }
            }
        }
    });

});

function createGame() {
    const gameId = Math.floor(Math.random() * 16777215).toString(16);
    games[gameId] = {
        players: [],
        state: ['', '', '', '', '', '', '', '', ''],
        turn: 0,
        winner: null
    };
    return gameId;
}

// Get the first available game ID that has less than two players
function getAvailableGameId() {
    for (const gameId in games) {
        if (games[gameId].players.length < 2) {
            return gameId;
        }
    }
    return null;
}

// Create a new game or join an existing game
function joinGame(socket) {
    const gameId = getAvailableGameId() || createGame();
    const game = games[gameId];
    game.players.push(socket.id);
    socket.join(gameId);
    socket.emit('joined', gameId);

    if (game.players.length === 2) {
        io.to(gameId).emit('start', game.state, game.turn);
    }
}

// Check if the game has been won
function checkWin(game) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    for (const line of lines) {
        const [a, b, c] = line;
        if (game.state[a] && game.state[a] === game.state[b] && game.state[a] === game.state[c]) {
            game.winner = game.state[a];
            return;
        }
    }
    if (game.turn === 9) {
        game.winner = 'tie';
    }
}

// Listen on port 3000
server.listen(3000, () => {
    console.log('Server running on port 3000');
});
