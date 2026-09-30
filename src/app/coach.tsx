import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../state/AppContext';
import { askCoach, loadCoachMessages, saveCoachMessages, type CoachMessage, type CoachMode, type CoachShot } from '../coach';
import { TechniqueLessonCard } from '../TechniqueLessonCard';
import type { CoachVideoAsset } from '../coachVideo';
import CoachPoseAnalyzer, { type CoachPoseAnalyzerHandle } from '../CoachPoseAnalyzer';
import { colors } from '../ui';

const shotLabel: Record<Exclude<CoachShot, null>, string> = { front: 'фронтально', side: 'сбоку', diagonal: 'по диагонали' };

export default function CoachScreen() {
  const { profile, program, history } = useApp();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [video, setVideo] = useState<CoachVideoAsset | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const latestMessageY = useRef(0);
  const shouldPositionLatest = useRef(true);
  const screen = useRef<View>(null);
  const poseAnalyzer = useRef<CoachPoseAnalyzerHandle>(null);

  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      if (latestMessageY.current > 0) scroll.current?.scrollTo({ y: Math.max(0, latestMessageY.current - 8), animated });
      else scroll.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    void loadCoachMessages().then(value => {
      shouldPositionLatest.current = true;
      setMessages(value);
      setTimeout(() => scrollToLatest(false), 40);
    });
  }, [scrollToLatest]);
  useEffect(() => { if (messages.length) void saveCoachMessages(messages); }, [messages]);
  useEffect(() => {
    if (!messages.length) return;
    shouldPositionLatest.current = true;
    setTimeout(() => scrollToLatest(messages.length > 1), 30);
  }, [messages.length, scrollToLatest]);
  useFocusEffect(useCallback(() => {
    shouldPositionLatest.current = true;
    const timers = [0, 100, 300].map(delay => setTimeout(() => scrollToLatest(false), delay));
    return () => timers.forEach(clearTimeout);
  }, [scrollToLatest]));
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ImagePicker.getPendingResultAsync().then(result => {
      if (result && 'canceled' in result && !result.canceled && result.assets?.[0]?.type === 'video') setVideo(result.assets[0]);
    });
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', event => {
      requestAnimationFrame(() => {
        screen.current?.measureInWindow((_x, y, _width, height) => {
          setKeyboardInset(Math.max(0, y + height - event.endCoordinates.screenY));
        });
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const context = useMemo(() => ({
    goal: 'улучшить технику и прогрессировать без боли',
    program: program ? { baseline: program.baseline, difficulty: program.difficulty, day: program.days.find(day => day.status === 'upcoming')?.index ?? 30 } : null,
    recentSessions: history.slice(0, 8).map(item => ({ mode: item.mode, reps: item.reps, goal: item.goal, seconds: item.seconds, date: item.date })),
  }), [history, program]);

  const displayedMessages = useMemo(() => messages.map(item => {
    if (!item.id.startsWith('workout-coach-')) return item;
    const matchingSession = history.find(session => session.technique?.summary === item.content);
    if (!matchingSession?.technique) return item;
    return {
      ...item,
      createdAt: item.createdAt ?? matchingSession.technique.assessedAt ?? matchingSession.date,
      score: item.score ?? matchingSession.technique.score,
      workout: item.workout ?? {
        mode: matchingSession.mode === 'light' ? 'light' : matchingSession.mode === 'free' ? 'free' : 'program',
        reps: matchingSession.reps,
        seconds: matchingSession.seconds,
        goal: matchingSession.goal,
        programDay: matchingSession.programDay,
      },
    } satisfies CoachMessage;
  }), [history, messages]);

  const acceptVideo = (asset?: CoachVideoAsset) => {
    if (!asset) return;
    setError('');
    setVideo(asset);
  };
  const choose = async () => {
    if (Platform.OS === 'android') {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/mp4', 'video/quicktime', 'video/webm', 'video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        acceptVideo({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType, file: asset.file });
      }
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Разреши доступ к медиатеке.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], selectionLimit: 1 });
    if (!result.canceled) acceptVideo(result.assets[0]);
  };
  const send = async () => {
    if (!video && !draft.trim()) return;
    const text = draft.trim() || (video ? 'Разбери мою технику на этом видео.' : 'Что мне делать дальше?');
    if (sending) return;
    const selectedVideo = video;
    const mode: CoachMode = selectedVideo ? 'direct' : 'insights';
    const userMessage: CoachMessage = { id: `user-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString(), video: Boolean(selectedVideo), mode };
    const previous = messages;
    setMessages([...previous, userMessage]);
    setDraft('');
    setVideo(null);
    setSending(true);
    setError('');
    try {
      const engineMetrics = selectedVideo ? await poseAnalyzer.current?.analyze(selectedVideo) ?? null : null;
      const result = await askCoach({ nickname: profile.nickname, message: text, history: previous, context, video: selectedVideo, engineMetrics, mode });
      setMessages(value => [...value, { id: `coach-${Date.now()}`, role: 'assistant', content: result.reply, createdAt: new Date().toISOString(), score: result.score, focus: result.focus, errors: result.errors, strengths: result.strengths, nextStep: result.nextStep, followUp: result.followUp, nextShot: result.nextShot, lessonId: result.lessonId, lessonIds: result.lessonIds }]);
    } catch (value) {
      setMessages(previous);
      setError(value instanceof Error && value.message ? value.message : 'Не удалось получить ответ тренера.');
    } finally {
      setSending(false);
    }
  };

  return <View ref={screen} style={s.screen}><CoachPoseAnalyzer ref={poseAnalyzer}/><KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    style={s.screen}
  >
    <ScrollView
      ref={scroll}
      contentContainerStyle={s.chat}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => { if (shouldPositionLatest.current) scrollToLatest(false); }}
      style={s.chatScroll}
    >
      {displayedMessages.map((item,index) => <Message key={item.id} item={item} onLayout={index===displayedMessages.length-1?(event)=>{
        latestMessageY.current=event.nativeEvent.layout.y;
        if(shouldPositionLatest.current){shouldPositionLatest.current=false;scrollToLatest(false)}
      }:undefined}/>)}
      {sending ? <View style={[s.bubble, s.assistant]}><ActivityIndicator color={colors.blue}/></View> : null}
    </ScrollView>
    <View style={[s.composer, keyboardInset > 0 && { marginBottom: keyboardInset }]}>
      {video ? <View style={s.videoChip}><Ionicons color={colors.blue} name="videocam" size={18}/><Text numberOfLines={1} style={s.videoName}>{video.fileName || 'Видео техники'}</Text><Pressable accessibilityLabel="Убрать видео" onPress={() => setVideo(null)}><Ionicons color={colors.secondary} name="close-circle" size={21}/></Pressable></View> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.inputRow}>
        <Pressable accessibilityLabel="Выбрать видео" disabled={sending} onPress={() => void choose()} style={({ pressed }) => [s.attachButton, sending && s.attachButtonDisabled, pressed && s.pressed]}><Ionicons color={colors.blue} name="videocam-outline" size={22}/></Pressable>
        <TextInput
          editable={!sending}
          multiline
          onChangeText={setDraft}
          onSubmitEditing={() => void send()}
          placeholder="Сообщение тренеру"
          placeholderTextColor={colors.tertiary}
          style={s.input}
          value={draft}
        />
        <Pressable accessibilityLabel="Отправить" disabled={sending || (!draft.trim() && !video)} onPress={() => void send()} style={({ pressed }) => [s.send, (!draft.trim() && !video) && s.sendDisabled, pressed && s.pressed]}><Ionicons color="#fff" name="arrow-up" size={21}/></Pressable>
      </View>
    </View>
  </KeyboardAvoidingView></View>;
}

const workoutLabel = { program: 'Основная тренировка', light: 'Лёгкая тренировка', free: 'Свободный подход' } as const;
const durationLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
function timeLabel(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Сегодня, ${time}`;
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${time}`;
}

function Message({ item, onLayout }: { item: CoachMessage; onLayout?: (event: LayoutChangeEvent) => void }) {
  const user = item.role === 'user';
  const showLegacyDetails = !user && item.content.length < 220;
  const workout = item.workout || item.id.startsWith('workout-coach-');
  const score = item.score;
  return <View onLayout={onLayout} style={[s.bubble, user ? s.user : s.assistant, workout && s.workoutBubble]}>
    {workout ? <View style={s.workoutHead}>
      <View style={s.workoutHeadCopy}>
        <Text style={s.workoutTitle}>{item.workout ? workoutLabel[item.workout.mode] : 'Разбор тренировки'}</Text>
        <Text style={s.workoutTime}>{timeLabel(item.createdAt)}</Text>
      </View>
    </View> : !user && score !== undefined && score !== null ? <View style={s.assessmentHead}><Text style={s.assessmentTime}>{timeLabel(item.createdAt)}</Text><View style={s.scoreBadgeSmall}><Text style={s.scoreValueSmall}>{String(score).replace('.', ',')} / 10</Text></View></View> : null}
    {workout && score !== undefined && score !== null ? <View style={s.workoutMeta}>
      <Text style={s.workoutResult}>{item.workout ? `${item.workout.reps} повторений · ${durationLabel(item.workout.seconds)}` : 'Оценка техники'}</Text>
      <Text allowFontScaling={false} numberOfLines={1} style={s.scoreValue}>{String(score).replace('.', ',')} <Text style={s.scoreMax}>/ 10</Text></Text>
    </View> : item.workout ? <Text style={s.workoutResultStandalone}>{item.workout.reps} повторений · {durationLabel(item.workout.seconds)}</Text> : null}
    {item.video ? <View style={s.attachment}><Ionicons color={user ? '#fff' : colors.blue} name="videocam" size={15}/><Text style={[s.attachmentText, user && s.userText]}>Видео техники</Text></View> : null}
    <Text style={[s.message, user && s.userText]}>{item.content}</Text>
    {showLegacyDetails && item.errors?.length ? <View style={s.analysis}>
      <Text style={s.analysisTitle}>Что исправить</Text>
      {item.errors.map((error, index) => <View key={`${item.id}-error-${index}`} style={s.analysisRow}>
        <View style={[s.analysisDot, index === 0 && s.analysisDotMain]}/>
        <View style={s.analysisCopy}>
          <Text style={s.analysisText}>{typeof error === 'string' ? error : error.observation}</Text>
          {typeof error !== 'string' && error.correction ? <Text style={s.analysisCorrection}>{error.correction}</Text> : null}
        </View>
      </View>)}
    </View> : null}
    {showLegacyDetails && item.strengths?.length ? <View style={s.strengths}>
      <Ionicons color="#1B9A62" name="checkmark-circle" size={17}/>
      <Text style={s.strengthsText}>{item.strengths.join(' · ')}</Text>
    </View> : null}
    {showLegacyDetails && item.nextStep ? <View style={s.nextStep}>
      <Ionicons color={colors.blue} name="arrow-forward-circle" size={18}/>
      <Text style={s.nextStepText}>{item.nextStep}</Text>
    </View> : null}
    {!user ? (item.lessonIds?.length ? item.lessonIds : item.lessonId ? [item.lessonId] : []).map(lessonId => <TechniqueLessonCard key={`${item.id}-${lessonId}`} lessonId={lessonId}/>) : null}
    {showLegacyDetails && item.followUp ? <View style={s.followUp}>
      <Ionicons color={colors.text} name="refresh-circle" size={18}/>
      <Text style={s.followUpText}>{item.followUp}</Text>
    </View> : null}
    {showLegacyDetails && item.nextShot ? <View style={s.nextShot}><Ionicons color={colors.blue} name="camera-outline" size={14}/><Text style={s.nextShotText}>Следующий ракурс: {shotLabel[item.nextShot]}</Text></View> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  chatScroll: { flex: 1 },
  chat: { padding: 16, paddingBottom: 22, gap: 10 },
  bubble: { maxWidth: '88%', borderRadius: 21, paddingHorizontal: 15, paddingVertical: 12 },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 7 },
  workoutBubble: { width: '100%', maxWidth: '100%', borderRadius: 22, borderBottomLeftRadius: 22, padding: 16 },
  workoutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  workoutHeadCopy: { flex: 1 },
  workoutTitle: { color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  workoutTime: { color: colors.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  workoutMeta: { minHeight: 50, borderRadius: 16, paddingHorizontal: 13, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  workoutResult: { flex: 1, color: colors.blue, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  workoutResultStandalone: { color: colors.blue, fontSize: 13, lineHeight: 18, fontWeight: '800', marginBottom: 10 },
  scoreValue: { flexShrink: 0, color: colors.blue, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -.7 },
  scoreMax: { color: colors.blue, fontSize: 11, lineHeight: 14, fontWeight: '800' },
  assessmentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  assessmentTime: { color: colors.secondary, fontSize: 11 },
  scoreBadgeSmall: { borderRadius: 10, backgroundColor: colors.blueSoft, paddingHorizontal: 8, paddingVertical: 4 },
  scoreValueSmall: { color: colors.blue, fontSize: 11, fontWeight: '800' },
  user: { alignSelf: 'flex-end', backgroundColor: colors.blue, borderBottomRightRadius: 7 },
  message: { color: colors.text, fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },
  attachment: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 7 },
  attachmentText: { color: colors.blue, fontSize: 11, fontWeight: '700' },
  nextShot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  nextShotText: { color: colors.blue, fontSize: 11, fontWeight: '700' },
  analysis: { marginTop: 11, gap: 7 },
  analysisTitle: { color: colors.secondary, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: .5 },
  analysisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  analysisCopy: { flex: 1, gap: 2 },
  analysisDot: { width: 6, height: 6, marginTop: 7, borderRadius: 3, backgroundColor: '#AEB4BD' },
  analysisDotMain: { backgroundColor: colors.blue },
  analysisText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  analysisCorrection: { color: colors.secondary, fontSize: 13, lineHeight: 18 },
  strengths: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  strengthsText: { flex: 1, color: '#19774E', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  nextStep: { marginTop: 11, padding: 10, borderRadius: 13, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  nextStepText: { flex: 1, color: colors.blue, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  lesson: { width: 268, maxWidth: '100%', marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#10141B' },
  lessonVideo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#10141B' },
  lessonCopy: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  lessonTitle: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  lessonCue: { color: '#B8C0CC', fontSize: 12, lineHeight: 17, marginTop: 3 },
  followUp: { marginTop: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  followUpText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  composer: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 24 : 12, backgroundColor: '#FFFFFFFA', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  attachButtonDisabled: { opacity: .4 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 19, backgroundColor: colors.bg, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 11, color: colors.text, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: .3 },
  pressed: { opacity: .72 },
  videoChip: { height: 38, marginBottom: 8, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  videoName: { flex: 1, color: colors.blue, fontSize: 12, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12, marginBottom: 8, paddingHorizontal: 3 },
});
