import React, { useEffect, useState, useRef } from 'react';
import { auth, database } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ref, push, set, onValue, update } from 'firebase/database';

const HomePage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [unseenCounts, setUnseenCounts] = useState({});
  const messageListRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate('/');
      else setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;

    const currentUid = currentUser.uid;
    const usersRef = ref(database, 'users');

    onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const all = [];
      for (let id in data) {
        if (id !== currentUid) {
          all.push({ uid: id, ...data[id] });
        }
      }
      setAllUsers(all);
    });

    const chatsRef = ref(database, 'chats');
    onValue(chatsRef, (snapshot) => {
      const chats = snapshot.val() || {};
      const chattedUids = new Set();

      Object.keys(chats).forEach((chatId) => {
        const [uid1, uid2] = chatId.split('_');
        if (uid1 === currentUid) chattedUids.add(uid2);
        else if (uid2 === currentUid) chattedUids.add(uid1);
      });

      const usersRef = ref(database, 'users');
      onValue(usersRef, (snap) => {
        const usersData = snap.val() || {};
        const chatted = [];

        chattedUids.forEach((uid) => {
          if (usersData[uid]) {
            chatted.push({ uid, ...usersData[uid] });
          }
        });

        setChatUsers(chatted);
      });

      // UNSEEN COUNT LOGIC
      const updatedCounts = {};
      Object.entries(chats).forEach(([chatId, chatMessages]) => {
        const [uid1, uid2] = chatId.split('_');
        if (uid1 !== currentUid && uid2 !== currentUid) return;

        const otherUid = uid1 === currentUid ? uid2 : uid1;
        let count = 0;
        Object.values(chatMessages).forEach((msg) => {
          if (msg.sender === otherUid && !msg.seen) {
            count++;
          }
        });
        if (count > 0) {
          updatedCounts[otherUid] = count;
        }
      });

      setUnseenCounts(updatedCounts);
    });
  }, [currentUser]);

  const logout = () => {
    signOut(auth);
    navigate('/');
  };

  const getChatId = (uid1, uid2) =>
    uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

  const sendMessage = () => {
    if (message.trim() === '' || !selectedUser) return;

    const chatId = getChatId(currentUser.uid, selectedUser.uid);
    const messagesRef = ref(database, `chats/${chatId}`);
    push(messagesRef, {
      text: message,
      sender: currentUser.uid,
      senderEmail: currentUser.email,
      receiver: selectedUser.uid,
      timestamp: new Date().toISOString(),
      seen: false,
    });
    setMessage('');
  };

  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const chatId = getChatId(currentUser.uid, selectedUser.uid);
    const messagesRef = ref(database, `chats/${chatId}`);

    // Listen to messages
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgList = Object.keys(data).map((id) => ({ id, ...data[id] }));
      msgList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(msgList);

      // Mark all messages from selectedUser as seen
      const updates = {};
      msgList.forEach((msg) => {
        if (msg.sender === selectedUser.uid && !msg.seen) {
             updates[`chats/${chatId}/${msg.id}/seen`] = true;  // <-- FIXED PATH HERE
        }
      });
      if (Object.keys(updates).length > 0) {
        update(ref(database), updates);
      }

      // Scroll to bottom
      setTimeout(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedUser, currentUser]);

  // Format timestamp helper (e.g. "Jul 18, 3:15 PM")
  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div style={styles.container}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.currentUserInfo}>
              <div style={styles.currentUserAvatar}>
                {currentUser?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={styles.currentUserName}>
                {currentUser?.displayName || 'Unknown User'}
              </div>
            </div>
            <button onClick={logout} style={styles.logoutBtn} title="Logout">
              Logout
            </button>
          </div>

          <div style={styles.userList}>
            {chatUsers.map((user) => (
              <div
                key={user.uid}
                style={{
                  ...styles.userListItem,
                  backgroundColor:
                    selectedUser?.uid === user.uid ? '#DCF8C6' : 'transparent',
                }}
                onClick={() => setSelectedUser(user)}
              >
                <div style={styles.userAvatar}>
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={styles.userEmail}>{user.name}</div>
                {unseenCounts[user.uid] > 0 && (
                  <div style={styles.notificationBadge}>
                    {unseenCounts[user.uid]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main style={styles.chatArea}>
          {selectedUser ? (
            <>
              <header style={styles.chatHeader}>
                <div style={styles.chatUserAvatar}>
                  {selectedUser.name[0].toUpperCase()}
                </div>
                <h3>{selectedUser.name}</h3>
              </header>

              <div style={styles.messageList} id="messageList" ref={messageListRef}>
                {messages.map((msg) => {
                  const isCurrentUser = msg.sender === currentUser.uid;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageBubble,
                        alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                        backgroundColor: isCurrentUser ? '#DCF8C6' : '#FFF',
                        position: 'relative',
                      }}
                    >
                      <div style={styles.messageText}>{msg.text}</div>
                      <div style={styles.messageTime}>
                        {formatTimestamp(msg.timestamp)}
                      </div>
                      {isCurrentUser && (
                        <div style={styles.readStatus}>
                          {msg.seen ? '✓✓' : '✓'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <footer style={styles.chatFooter}>
                <input
                  type="text"
                  placeholder="Type a message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  style={styles.messageInput}
                />
                <button onClick={sendMessage} style={styles.sendButton}>
                  ➤
                </button>
              </footer>
            </>
          ) : (
            <div style={styles.emptyChat}>Select a user to start chatting</div>
          )}
        </main>

        <button
          style={styles.newChatButton}
          title="New Chat"
          onClick={() => setShowUserListModal(true)}
        >
          +
        </button>
      </div>

      {showUserListModal && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setShowUserListModal(false)}
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Select User to Chat</h3>
            <div style={styles.modalUserList}>
              {allUsers.map((user) => (
                <div
                  key={user.uid}
                  style={styles.modalUserItem}
                  onClick={() => {
                    setSelectedUser(user);
                    setShowUserListModal(false);
                  }}
                >
                  {user.name}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowUserListModal(false)}
              style={{ marginTop: 10, padding: '8px 12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: '#ECE5DD',
    position: 'relative',
  },
  notificationBadge: {
    backgroundColor: 'red',
    color: 'white',
    fontSize: '12px',
    minWidth: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 6px',
    marginLeft: 'auto',
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#fff',
    borderRight: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '15px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutBtn: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  userList: {
    overflowY: 'auto',
    flex: 1,
  },
  userListItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 15px',
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
    transition: 'background-color 0.2s',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#25D366',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    fontWeight: 'bold',
    fontSize: '18px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeader: {
    backgroundColor: '#128C7E',
    color: 'white',
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chatUserAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#25D366',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
    color: 'white',
  },
  messageList: {
    flex: 1,
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    backgroundColor: '#ECE5DD',
  },
  messageBubble: {
    maxWidth: '60%',
    padding: '10px 14px',
    borderRadius: '7.5px',
    marginBottom: '10px',
    boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.13)',
  },
  messageText: {
    marginBottom: '5px',
  },
  messageTime: {
    fontSize: '11px',
    color: '#999',
    textAlign: 'right',
  },
  readStatus: {
    position: 'absolute',
    bottom: '5px',
    right: '8px',
    fontSize: '12px',
    color: '#666',
  },
  chatFooter: {
    display: 'flex',
    padding: '10px 15px',
    borderTop: '1px solid #ddd',
    backgroundColor: '#fff',
  },
  currentUserInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  currentUserAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#128C7E',
    color: 'white',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
  },
  currentUserName: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#333',
  },
  messageInput: {
    flex: 1,
    padding: '12px',
    borderRadius: '20px',
    border: '1px solid #ddd',
    outline: 'none',
    fontSize: '14px',
  },
  sendButton: {
    backgroundColor: '#128C7E',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    marginLeft: '10px',
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: '40px',
  },
  emptyChat: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#888',
    fontSize: '18px',
  },
  newChatButton: {
    position: 'fixed',
    bottom: '25px',
    right: '25px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#25D366',
    color: 'white',
    fontSize: '32px',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    width: '300px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  modalUserList: {
    marginTop: '10px',
  },
  modalUserItem: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
  },
};

export default HomePage;
