import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RATING_LEVELS, START_RATING, levelColor, levelForRating } from '../gamification';
import { Card, colors, LevelBadge, Screen, SectionLabel } from '../ui';

export default function RatingInfoScreen() {
  const startLevel = levelForRating(START_RATING).level;
  return <Screen>
    <Card style={s.start}>
      <LevelBadge level={startLevel} size={54}/>
      <Text style={s.startValue}>{START_RATING} PWR</Text>
      <Text style={s.startLevel}>Стартовый уровень · LVL {startLevel}</Text>
    </Card>

    <SectionLabel>Как меняется PWR</SectionLabel>
    <Card style={s.rules}>
      <Rule value="+25" label="Победа" tone="up"/>
      <Rule value="0" label="Ничья"/>
      <Rule value="−25" label="Поражение" tone="down"/>
    </Card>
    <Text style={s.note}>На рейтинг влияют только завершённые матчи. Тренировки и достижения PWR не меняют.</Text>

    <SectionLabel>Уровни</SectionLabel>
    <Card style={s.levels}>
      {RATING_LEVELS.map((band, index) => {
        const next = RATING_LEVELS[index + 1];
        const range = next ? `${band.min}–${next.min - 1}` : `${band.min}+`;
        return <View key={band.level} style={[s.levelRow, index > 0 && s.line]}>
          <View style={s.levelIdentity}><LevelBadge level={band.level} size={28}/><Text style={s.levelName}>LVL {band.level}</Text></View>
          <Text style={[s.levelRange,{color:levelColor(band.level)}]}>{range} PWR</Text>
        </View>;
      })}
    </Card>
  </Screen>;
}

function Rule({ value, label, tone }: { value: string; label: string; tone?: 'up' | 'down' }) {
  return <View style={s.rule}><Text style={[s.ruleValue, tone === 'up' && s.up, tone === 'down' && s.down]}>{value}</Text><Text style={s.ruleLabel}>{label}</Text></View>;
}

const s = StyleSheet.create({
  start:{alignItems:'center',paddingVertical:27},startValue:{fontSize:38,fontWeight:'800',letterSpacing:-1,marginTop:12},startLevel:{fontSize:13,color:colors.secondary,marginTop:5},
  rules:{flexDirection:'row',paddingHorizontal:8},rule:{flex:1,alignItems:'center'},ruleValue:{fontSize:25,fontWeight:'800'},ruleLabel:{fontSize:11,color:colors.secondary,marginTop:4},up:{color:colors.green},down:{color:colors.red},note:{fontSize:12,lineHeight:17,color:colors.secondary,marginHorizontal:5,marginTop:9},
  levels:{paddingVertical:2},levelRow:{height:51,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},levelIdentity:{flexDirection:'row',alignItems:'center',gap:9},line:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.line},levelName:{fontSize:15,fontWeight:'700'},levelRange:{fontSize:14,fontWeight:'700'},
});
