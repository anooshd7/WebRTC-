// getting Dom elements
var home = document.getElementById("Home");
var callRoom = document.getElementById("CallRoom");
var start = document.getElementById("start");
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");
var btnMute = document.getElementById("mute");
var listAudioEvents = document.getElementById("audioEvents");

// variables
var roomNumber = 'webrtc-audio';
var localStream;
var remoteStream;
var rtcPeerConnection;
var iceServers = { 
    'iceServers': [{
            'url': 'stun:stun.services.mozilla.com'
        },
        {
            'url': 'stun:stun.l.google.com:19302'
        },
        {
            url: 'turn:192.158.29.39:3478?transport=tcp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808'
        }
    ]
}
var streamConstraints;
var isCaller;

// Socket.io initialization
var socket = io();

start.onclick = () => initiateCall(true);
btnMute.onclick = toggleAudio;

function initiateCall(audio) {
    streamConstraints = {
        video:true,
        audio: audio
    }
    socket.emit('create or join', roomNumber);
    home.style = "display: none;";
    callRoom.style = "display: block;";
}

// Message handlers
socket.on('created', function () {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        addLocalStream(stream);
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices');
    });
});

socket.on('joined', function () {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        addLocalStream(stream);
        socket.emit('ready', roomNumber);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices');
    });
});


/* sdpMid:  The read-only property sdpMid on the RTCIceCandidate interface returns a string specifying 
the media stream identification tag of the media component with which the candidate is associated. 
This ID uniquely identifies a given stream for the component with which the candidate is associated.
   sdpMLineIndex:  zero-based index of the m-line describing the media associated with the candidate.
*/
socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

//creates offer when peer connection is ready
socket.on('ready', function () {
    if (isCaller) {
        createPeerConnection();
        let offerOptions = {
            offerToReceiveAudio: 1
        }
        rtcPeerConnection.createOffer(offerOptions)
            .then(desc => setLocalAndOffer(desc))
            .catch(e => console.log(e));
    }
});

//creates answer when offer is received
socket.on('offer', function (event) {
    if (!isCaller) {
        createPeerConnection();
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer()
            .then(desc => setLocalAndAnswer(desc))
            .catch(e => console.log(e));
    }
});

// when answer is received
socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

// toggles audio on and off
socket.on('toggleAudio', function (event) {
    addAudioEvent(event);
});

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        })
    }
}

function onAddStream(event) {
    remoteVideo.srcObject  = event.stream;
    remoteStream = event.stream;
    if (remoteStream.getAudioTracks().length > 0) {
        addAudioEvent('Remote user is sending Audio');
    } else {
        addAudioEvent('Remote user is not sending Audio');
    }
}

function setLocalAndOffer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('offer', {
        type: 'offer',
        sdp: sessionDescription,
        room: roomNumber
    });
}

function setLocalAndAnswer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('answer', {
        type: 'answer',
        sdp: sessionDescription,
        room: roomNumber
    });
}

//utility functions
function addLocalStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream

    if (stream.getAudioTracks().length > 0) {
        btnMute.style = "display: block";
    }
}

function createPeerConnection() {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.onaddstream = onAddStream;
    rtcPeerConnection.addStream(localStream);
}

function toggleAudio() {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled
    socket.emit('toggleAudio', {
        type: 'toggleAudio',
        room: roomNumber,
        message: localStream.getAudioTracks()[0].enabled ? "Remote user's audio is unmuted" : "Remote user's audio is muted"
    });
}

function addAudioEvent(event) {
    var p = document.createElement("p");
    p.appendChild(document.createTextNode(event));
    listAudioEvents.appendChild(p);
}