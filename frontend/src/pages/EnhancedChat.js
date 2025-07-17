import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from '../firebase';
import { ref, push, onChildAdded, update, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const EnhancedChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const chatRef = ref(db, 'messages');
    onChildAdded(chatRef, (snapshot) => {
      const message = snapshot.val();
      message.id = snapshot.key;
      setMessages((prev) => {
        const updated = [...prev, message];

        // Update read status
        if (!message.readBy || !message.readBy[user.uid]) {
          const readPath = `messages/${message.id}/readBy/${user.uid}`;
          set(ref(db, readPath), true);
        }

        return updated;
      });
    });
  }, [user]);

  const handleSend = () => {
    if (newMessage.trim() === '' || !user) return;
    const chatRef = ref(db, 'messages');
    push(chatRef, {
      text: newMessage,
      sender: user.email,
      timestamp: Date.now(),
      readBy: {
        [user.uid]: true,
      },
    });
    setNewMessage('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>CloudChat</h2>
      <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '10px' }}>
            <div><strong>{msg.sender}</strong>: {msg.text}</div>
            <div style={{ fontSize: '0.8em', color: 'gray' }}>
              {msg.readBy && Object.keys(msg.readBy).length > 1 ? '✓✓ Read' : '✓ Sent'}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type your message..."
        style={{ width: '80%', padding: '10px', marginTop: '10px' }}
      />
      <button onClick={handleSend} style={{ padding: '10px' }}>Send</button>
    </div>
  );
};

export default EnhancedChat;