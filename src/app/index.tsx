import React from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '../state/AppContext';
import { Loading } from '../ui';

export default function Index() {
  const { loaded, program } = useApp();
  if (!loaded) return <Loading/>;
  return <Redirect href={program ? '/(tabs)/home' : '/setup'}/>;
}
