// 1. Initialize Peer (Connects to PeerJS Cloud by default)
const peer = new Peer();
let activeConn = null;

// 2. Get your unique ID from the cloud server
peer.on('open', (id) => {
    document.getElementById('my-id').innerText = id;
    console.log('My peer ID is: ' + id);
});

// 3. Listen for incoming connections (The "Receiver" side)
peer.on('connection', (conn) => {
    activeConn = conn;
    setupMessageListeners(conn);
    document.getElementById('status').innerText = "Status: Connected to " + conn.peer;
});

// 4. Initiate a connection (The "Sender" side)
function connectToPeer() {
    const targetId = document.getElementById('receiver-id').value;
    activeConn = peer.connect(targetId);
    
    activeConn.on('open', () => {
        document.getElementById('status').innerText = "Status: Connected to " + targetId;
        setupMessageListeners(activeConn);
    });
}

// 5. Handle sending/receiving data
function setupMessageListeners(conn) {
    conn.on('data', (data) => {
        alert("Received message: " + data);
    });
}

function sendMessage() {
    const msg = document.getElementById('message').value;
    if (activeConn && activeConn.open) {
        activeConn.send(msg);
    } else {
        alert("Not connected to a peer!");
    }
}