import React, { useEffect, useState } from 'react';
import { auth, database } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ref, push, onValue } from 'firebase/database';

const HomePage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserListModal, setShowUserListModal] = useState(false);

  const logout = () => {
    signOut(auth);
    navigate('/');
  };

  const getChatId = (uid1, uid2) => (uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`);

  // Send message
  const sendMessage = () => {
    if (message.trim() === '' || !selectedUser) return;

    const chatId = getChatId(auth.currentUser.uid, selectedUser.uid);
    const messagesRef = ref(database, `chats/${chatId}`);
    push(messagesRef, {
      text: message,
      sender: auth.currentUser.uid,
      senderEmail: auth.currentUser.email,
      receiver: selectedUser.uid,
      timestamp: new Date().toISOString(),
    });
    setMessage('');
  };

  // Load users except current
  useEffect(() => {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const userList = [];
      for (let id in data) {
        if (id !== auth.currentUser.uid) {
       userList.push({ uid: id, ...data[id] }); // 🔁 include full user data
        }
      }
      setUsers(userList);
    });
  }, []);

  // Load messages for selected user
  useEffect(() => {
    if (!selectedUser) return;
    const chatId = getChatId(auth.currentUser.uid, selectedUser.uid);
    const messagesRef = ref(database, `chats/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgList = Object.keys(data).map((id) => ({ id, ...data[id] }));
      msgList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(msgList);
    });
    return () => unsubscribe();
  }, [selectedUser]);

  return (
    <>
      <div style={styles.container}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h2>CloudChat</h2>
            <button onClick={logout} style={styles.logoutBtn} title="Logout">
              Logout
            </button>
          </div>
          <div style={styles.userList}>
            {users.map((user) => (
              <div
                key={user.uid}
                style={{
                  ...styles.userListItem,
                  backgroundColor: selectedUser?.uid === user.uid ? '#DCF8C6' : 'transparent',
                }}
                onClick={() => setSelectedUser(user)}
              >
                <div style={styles.userAvatar}>{user.email[0].toUpperCase()}</div>
                <div style={styles.userEmail}>{user.email}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <main style={styles.chatArea}>
          {selectedUser ? (
            <>
              <header style={styles.chatHeader}>
                <div style={styles.chatUserAvatar}>{selectedUser.email[0].toUpperCase()}</div>
                <h3>{selectedUser.email}</h3>
              </header>

              <div style={styles.messageList} id="messageList">
                {messages.map((msg) => {
                  const isCurrentUser = msg.sender === auth.currentUser.uid;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        ...styles.messageBubble,
                        alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
                        backgroundColor: isCurrentUser ? '#DCF8C6' : '#FFF',
                        color: '#000',
                      }}
                    >
                      <div style={styles.messageText}>{msg.text}</div>
                      <div style={styles.messageTime}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
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

        {/* Floating new chat button */}
        <button
          style={styles.newChatButton}
          title="New Chat"
          onClick={() => setShowUserListModal(true)}
        >
          +
        </button>
      </div>

      {/* Modal to select user to chat with */}
      {showUserListModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowUserListModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Select User to Chat</h3>
            <div style={styles.modalUserList}>
              {users.map((user) => (
                <div
                  key={user.uid}
                  style={styles.modalUserItem}
                  onClick={() => {
                    setSelectedUser(user);
                    setShowUserListModal(false);
                  }}
                >
                  {user.email}
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
  chatFooter: {
    display: 'flex',
    padding: '10px 15px',
    borderTop: '1px solid #ddd',
    backgroundColor: '#fff',
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
