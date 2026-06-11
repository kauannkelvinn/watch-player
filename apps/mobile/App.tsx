import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';

const PLATFORMS = [
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com', color: '#E50914' },
  { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://www.crunchyroll.com', color: '#F47521' },
  { id: 'disney', name: 'Disney+', url: 'https://www.disneyplus.com', color: '#113CCF' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com', color: '#00F2FE' },
];

export default function App() {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!activeUrl) {
    return (
      <SafeAreaView style={styles.hubContainer}>
        <View style={styles.hubHeader}>
          <Text style={styles.hubTitle}>WATCH.PARTY</Text>
          <Text style={styles.hubSubtitle}>Select your universe</Text>
        </View>

        <View style={styles.grid}>
          {PLATFORMS.map((platform) => (
            <TouchableOpacity 
              key={platform.id} 
              style={[styles.card, { borderLeftColor: platform.color }]}
              onPress={() => setActiveUrl(platform.url)}
            >
              <Text style={styles.cardText}>{platform.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // 2. O MODO CINEMA (WebView + Chat)
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: activeUrl }}
        style={styles.webview}
        allowsFullscreenVideo={true}
        showsHorizontalScrollIndicator={false}
        bounces={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
        pointerEvents="box-none"
      >
        {isChatOpen ? (
          <View style={styles.chatGlass}>
            <View style={styles.chatHeader}>
              {/* Botão de voltar para o Hub */}
              <TouchableOpacity onPress={() => {
                setActiveUrl(null);
                setIsChatOpen(false);
              }}>
                <Text style={styles.backIcon}>← Hub</Text>
              </TouchableOpacity>
              
              <Text style={styles.chatTitle}>ROOM: 8A42</Text>
              
              <TouchableOpacity onPress={() => setIsChatOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.messagesArea}>
              <Text style={styles.mockMessage}><Text style={styles.mockName}>Carol: </Text>Bota logo o ep novo!!</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Say something..."
                placeholderTextColor="#666"
                value={message}
                onChangeText={setMessage}
              />
              <TouchableOpacity style={styles.sendBtn}>
                <Text style={styles.sendIcon}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.openChatBtn} onPress={() => setIsChatOpen(true)}>
            <Text style={styles.openChatText}>💬 Chat</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hubContainer: {
    flex: 1,
    backgroundColor: '#050505',
    padding: 24,
    justifyContent: 'center',
  },
  hubHeader: {
    marginBottom: 40,
  },
  hubTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  hubSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 1,
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 12,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  chatGlass: {
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    maxHeight: '60%',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backIcon: {
    color: '#aaa',
    fontWeight: 'bold',
    fontSize: 12,
  },
  chatTitle: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 12,
  },
  closeIcon: {
    color: '#666',
    fontWeight: 'bold',
  },
  messagesArea: {
    padding: 12,
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  mockMessage: {
    color: '#ccc',
    marginBottom: 8,
  },
  mockName: {
    color: '#8b5cf6',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    height: 40,
  },
  sendBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    width: 40,
    marginLeft: 8,
  },
  sendIcon: {
    color: '#fff',
  },
  openChatBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  openChatText: {
    color: '#fff',
    fontWeight: '600',
  }
});