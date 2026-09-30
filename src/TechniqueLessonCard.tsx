import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { coachLessons, type CoachLessonId } from './coachLessons';
import { colors } from './ui';

export function TechniqueLessonCard({ lessonId }: { lessonId: CoachLessonId }) {
  const lesson = coachLessons[lessonId];
  const player = useVideoPlayer(lesson.source, instance => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <View style={s.lesson}>
    <VideoView contentFit="cover" fullscreenOptions={{ enable: true }} nativeControls={false} player={player} playsInline style={s.video} surfaceType="textureView"/>
    <View style={s.copy}><Text style={s.title}>{lesson.title}</Text><Text style={s.cue}>{lesson.cue}</Text></View>
  </View>;
}

const s=StyleSheet.create({
  lesson:{marginTop:12,borderRadius:18,overflow:'hidden',backgroundColor:'#EEF1F5'},
  video:{width:'100%',aspectRatio:16/10,backgroundColor:'#DDE3E9'},
  copy:{paddingHorizontal:13,paddingVertical:11},
  title:{fontSize:14,fontWeight:'800',color:colors.text},
  cue:{fontSize:12,lineHeight:17,color:colors.secondary,marginTop:3},
});
