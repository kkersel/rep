import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { AchievementMedalHero } from '../AchievementMedalHero';
import type { Achievement } from '../gamification';
import { useApp } from '../state/AppContext';
import { fetchFriendProfile } from '../supabase';

function Backdrop({ width, height }: { width: number; height: number }) {
  return <View pointerEvents="none" style={s.backdrop}>
  <Svg height={height + 4} preserveAspectRatio="xMidYMid slice" style={s.backdropSvg} viewBox="0 0 100 100" width={width + 4}>
    <Defs>
      <RadialGradient cx="50%" cy="43%" id="sphere" r="72%">
        <Stop offset="0%" stopColor="#4A83CC"/><Stop offset="27%" stopColor="#285493"/>
        <Stop offset="59%" stopColor="#122D55"/><Stop offset="83%" stopColor="#09182E"/><Stop offset="100%" stopColor="#050B16"/>
      </RadialGradient>
      <RadialGradient cx="50%" cy="46%" id="light" r="48%">
        <Stop offset="0%" stopColor="#D6E9FF" stopOpacity=".14"/><Stop offset="62%" stopColor="#8CC0FF" stopOpacity=".04"/><Stop offset="100%" stopColor="#8CC0FF" stopOpacity="0"/>
      </RadialGradient>
    </Defs>
    <Rect fill="url(#sphere)" height="100" width="100" x="0" y="0"/><Rect fill="url(#light)" height="100" width="100" x="0" y="0"/>
  </Svg></View>;
}

export default function AchievementScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; friendId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const friendId = Array.isArray(params.friendId) ? params.friendId[0] : params.friendId;
  const { gamification } = useApp();
  const { width, height } = useWindowDimensions();
  const [currentId, setCurrentId] = useState(id ?? '');
  const [remoteItems, setRemoteItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(Boolean(friendId));
  const [error, setError] = useState('');
  const [offsetX] = useState(() => new Animated.Value(0));
  const [offsetY] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!friendId) return;
    let active = true;
    fetchFriendProfile(friendId)
      .then(profile => { if (active) setRemoteItems(profile.achievements); })
      .catch(() => { if (active) setError('Не удалось загрузить достижение'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [friendId]);

  const items = friendId ? remoteItems : gamification.achievements;
  const index = Math.max(0, items.findIndex(value => value.id === currentId));
  const item = items[index] ?? null;
  const unlocked = Boolean(item?.unlockedAt);

  const resetPosition = useCallback(() => Animated.parallel([
    Animated.spring(offsetX, { toValue: 0, speed: 24, bounciness: 4, useNativeDriver: Platform.OS !== 'web' }),
    Animated.spring(offsetY, { toValue: 0, speed: 24, bounciness: 4, useNativeDriver: Platform.OS !== 'web' }),
    Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }),
  ]).start(), [offsetX, offsetY, opacity]);

  const show = useCallback((direction: 1 | -1) => {
    if (animating || !items.length) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) {
      resetPosition();
      return;
    }
    setAnimating(true);
    const exitX = direction === 1 ? -width * .42 : width * .42;
    Animated.parallel([
      Animated.timing(offsetX, { toValue: exitX, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: .08, duration: 110, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      const next = items[nextIndex];
      setCurrentId(next.id);
      router.setParams({ id: next.id });
      offsetX.setValue(-exitX * .7);
      offsetY.setValue(0);
      Animated.parallel([
        Animated.spring(offsetX, { toValue: 0, speed: 25, bounciness: 3, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => setAnimating(false));
    });
  }, [animating, index, items, offsetX, offsetY, opacity, resetPosition, width]);

  const close = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    Animated.parallel([
      Animated.timing(offsetY, { toValue: height * .8, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 0, duration: 165, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/achievements');
    });
  }, [animating, height, offsetY, opacity]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 10,
    onPanResponderMove: (_, gesture) => {
      offsetX.setValue(gesture.dx * .28);
      offsetY.setValue(Math.max(0, gesture.dy) * .42);
      opacity.setValue(Math.max(.55, 1 - Math.abs(gesture.dx) / (width * 1.3) - Math.max(0, gesture.dy) / (height * .8)));
    },
    onPanResponderRelease: (_, gesture) => {
      const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15;
      if (gesture.dy > 82 && gesture.dy > Math.abs(gesture.dx) * .9) close();
      else if (horizontal && gesture.dx < -65) show(1);
      else if (horizontal && gesture.dx > 65) show(-1);
      else resetPosition();
    },
    onPanResponderTerminate: resetPosition,
  }), [close, height, offsetX, offsetY, opacity, resetPosition, show, width]);

  return <View style={s.screen}>
    <StatusBar style="light"/>
    <Backdrop height={height} width={width}/>
    <Pressable accessibilityLabel="Закрыть" accessibilityRole="button" onPress={close} style={s.close}><Ionicons color="#fff" name="close" size={25}/></Pressable>
    {loading ? <ActivityIndicator color="#fff" size="large"/> : error || !item ? <Text style={s.error}>{error || 'Достижение не найдено'}</Text> : <Animated.View {...pan.panHandlers} style={[s.content,{opacity,transform:[{translateX:offsetX},{translateY:offsetY}]}]}>
      <View style={s.stage}><AchievementMedalHero id={item.id} onSwipeDown={close} onSwipeLeft={()=>show(1)} onSwipeRight={()=>show(-1)} unlocked={unlocked}/></View>
      <Text style={s.title}>{item.title}</Text><Text style={s.detail}>{item.detail}</Text>
      <Text style={s.progress}>{unlocked ? `Получено ${new Date(item.unlockedAt!).toLocaleDateString('ru-RU')}` : `${Math.min(item.current, item.target)} из ${item.target}`}</Text>
      <View accessibilityLabel={`Достижение ${index + 1} из ${items.length}`} style={s.pager}>{items.map((value, itemIndex)=><View key={value.id} style={[s.dot,itemIndex===index&&s.dotActive]}/>)}</View>
    </Animated.View>}
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#050B16',overflow:'hidden'},backdrop:{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#050B16',overflow:'hidden'},backdropSvg:{position:'absolute',left:-2,top:-2},close:{position:'absolute',zIndex:3,right:20,top:54,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(4,11,24,.34)',borderWidth:1,borderColor:'rgba(255,255,255,.2)'},content:{width:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:28},stage:{width:'100%',height:368,alignItems:'center',justifyContent:'center'},title:{fontSize:30,fontWeight:'800',letterSpacing:-.7,color:'#fff',textAlign:'center'},detail:{fontSize:15,lineHeight:21,color:'rgba(255,255,255,.68)',textAlign:'center',marginTop:8},progress:{fontSize:14,fontWeight:'700',color:'#A9D1FF',marginTop:17},pager:{height:18,marginTop:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},dot:{width:5,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,.22)'},dotActive:{width:16,backgroundColor:'rgba(255,255,255,.85)'},error:{fontSize:16,color:'rgba(255,255,255,.75)',textAlign:'center'},
});
