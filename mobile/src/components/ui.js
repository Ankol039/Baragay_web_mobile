import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { styles as s, colors } from '../theme.js'
export function Button({ title, onPress, disabled, secondary, danger }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress} disabled={disabled}
    style={[s.button, secondary && s.secondary, danger && { backgroundColor: colors.danger }, disabled && { opacity: .5 }]}>
    <Text style={[s.buttonText, secondary && { color: colors.dark }]}>{title}</Text></Pressable>
}
export const Heading = ({ children }) => <Text accessibilityRole="header" style={s.heading}>{children}</Text>
export const Card = ({ title, children }) => <View style={s.card}>{title && <Heading>{title}</Heading>}{children}</View>
export const Notice = ({ children, error = false }) => children ? <Text accessibilityRole="alert" style={error ? s.error : s.notice}>{children}</Text> : null
export function Field({ label, value, onChange, options, password, multiline, ...rest }) {
  const [visible, setVisible] = useState(false)
  return <View><Text style={s.label}>{label}</Text>{options ? <View style={s.input}><Picker accessibilityLabel={label} selectedValue={value || ''} onValueChange={onChange}>
    <Picker.Item label="Select" value="" />{Object.entries(Array.isArray(options) ? Object.fromEntries(options.map(v => [v, v])) : options)
      .map(([key, title]) => <Picker.Item key={key} value={key} label={title} />)}</Picker></View>
    : <TextInput accessibilityLabel={label} style={[s.input, multiline && { minHeight: 110, textAlignVertical: 'top' }]} value={String(value ?? '')}
      onChangeText={onChange} autoCapitalize={password ? 'none' : 'sentences'} secureTextEntry={password && !visible} multiline={multiline} {...rest} />}
    {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)}><Text style={s.muted}>{visible ? 'Hide password' : 'Show password'}</Text></Pressable>}
  </View>
}
export const Details = ({ rows }) => <View style={{ gap: 10 }}>{rows.map(([label, value], i) => <View key={`${label}-${i}`} style={s.divider}><Text style={s.muted}>{label}</Text><Text selectable style={s.text}>{value == null || value === '' ? 'N/A' : String(value)}</Text></View>)}</View>
export function Page({ title, subtitle, resource, children }) {
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
    refreshControl={resource && <RefreshControl refreshing={resource.refreshing} onRefresh={resource.refresh} tintColor={colors.primary} />}>
    {title && <Text accessibilityRole="header" style={s.title}>{title}</Text>}{subtitle && <Text style={s.muted}>{subtitle}</Text>}
    {resource?.loading && <ActivityIndicator accessibilityLabel="Loading" color={colors.primary} />}
    {resource?.error && <><Notice error>{resource.error}</Notice><Button secondary title="Try Again" onPress={resource.refresh} /></>}
    {children}
  </ScrollView></KeyboardAvoidingView>
}
