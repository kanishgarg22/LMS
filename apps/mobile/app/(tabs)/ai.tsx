import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { aiApi } from '../../src/utils/api';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'Who was absent today?',
  'Show pending salaries',
  'आज राहुल को present mark करो',
  'Show this month payroll',
  'How much advance did workers take?',
];

export default function AIScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0', role: 'assistant', timestamp: new Date(),
      content: 'Namaste! 🙏\n\nMain aapka AI Labour Assistant hoon.\n\nMujhse poochh sakte ho:\n• Attendance mark karna\n• Payroll check karna\n• Absent workers dekhna\n• Advance payments\n\nHindi ya English mein baat karo!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await aiApi.chat(history);
      const { message } = res.data.data;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: message || 'Request processed.',
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Sorry, AI service is not available right now.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgRow, item.role === 'user' ? styles.userRow : styles.assistantRow]}>
      {item.role === 'assistant' && (
        <View style={styles.botAvatar}>
          <Ionicons name="sparkles" size={14} color="white" />
        </View>
      )}
      <View style={[styles.msgBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.msgText, item.role === 'user' ? styles.userText : styles.assistantText]}>
          {item.content}
        </Text>
        <Text style={styles.msgTime}>
          {item.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {item.role === 'user' && (
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={14} color="white" />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={20} color="white" />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Labour Assistant</Text>
          <Text style={styles.headerSub}>Powered by GPT-4 · Hindi & English</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loading ? (
              <View style={[styles.msgRow, styles.assistantRow]}>
                <View style={styles.botAvatar}>
                  <Ionicons name="sparkles" size={14} color="white" />
                </View>
                <View style={[styles.msgBubble, styles.assistantBubble]}>
                  <View style={styles.typingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Suggestions */}
        {messages.length <= 1 && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.suggestion} onPress={() => sendMessage(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything... (English या Hindi)"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#94a3b8' },
  messageList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end',
  },
  userAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end',
  },
  msgBubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  userBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: 'white', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgText: { fontSize: 14, lineHeight: 20 },
  userText: { color: 'white' },
  assistantText: { color: '#1e293b' },
  msgTime: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  typingDots: { flexDirection: 'row', gap: 4, padding: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94a3b8' },
  dot1: {}, dot2: { opacity: 0.7 }, dot3: { opacity: 0.4 },
  suggestions: {
    paddingHorizontal: 12, paddingBottom: 8,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  suggestion: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  suggestionText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8,
    backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  inputWrapper: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: '#e2e8f0',
    maxHeight: 100,
  },
  textInput: { fontSize: 14, color: '#1e293b', maxHeight: 80 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
