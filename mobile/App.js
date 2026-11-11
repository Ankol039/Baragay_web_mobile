import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Text, ActivityIndicator } from 'react-native'
import { AuthProvider, useAuth } from './src/context/AuthContext.js'
import { Page, Button, Notice } from './src/components/ui.js'
import { colors } from './src/theme.js'
import Login from './src/screens/Login.js'
import Register from './src/screens/Register.js'
import ChangePassword from './src/screens/ChangePassword.js'
import Dashboard from './src/screens/Dashboard.js'
import Surveys from './src/screens/Surveys.js'
import Survey from './src/screens/Survey.js'
import Confirmation from './src/screens/Confirmation.js'
import History from './src/screens/History.js'
import Response from './src/screens/Response.js'
import Profile from './src/screens/Profile.js'
import EditProfile from './src/screens/EditProfile.js'
import StatDetail from './src/screens/StatDetail.js'
const Stack = createNativeStackNavigator(), Tabs = createBottomTabNavigator()
function ResidentTabs() {
  return <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarLabelStyle: { fontSize: 12 }, tabBarIcon: ({ color }) => <Text style={{ color }}>●</Text> }}>
    <Tabs.Screen name="Overview" component={Dashboard} /><Tabs.Screen name="Surveys" component={Surveys} /><Tabs.Screen name="History" component={History} /><Tabs.Screen name="Profile" component={Profile} />
  </Tabs.Navigator>
}
function Routes() {
  const auth = useAuth()
  if (auth.loading) return <Page title="Barangay Health Center"><ActivityIndicator color={colors.primary} /></Page>
  return <NavigationContainer><Stack.Navigator screenOptions={{ headerTintColor: colors.dark, headerStyle: { backgroundColor: '#fff' } }}>
    {!auth.user ? <><Stack.Screen name="Login" component={Login} options={{ title: 'Sign In' }} /><Stack.Screen name="Register" component={Register} /></>
      : auth.user.is_first_login ? <Stack.Screen name="FirstPassword" component={ChangePassword} options={{ title: 'Change Password', headerBackVisible: false }} />
      : !auth.user.profile_completed ? <Stack.Screen name="Setup">{() => <Page title="My Profile"><Notice>Please contact the Barangay Health Center to complete your resident record.</Notice><Button title="Logout" onPress={auth.logout} /></Page>}</Stack.Screen>
      : <><Stack.Screen name="Resident" component={ResidentTabs} options={{ title: 'Resident Portal' }} /><Stack.Screen name="Survey" component={Survey} /><Stack.Screen name="Confirmation" component={Confirmation} />
        <Stack.Screen name="Response" component={Response} /><Stack.Screen name="EditProfile" component={EditProfile} options={{ title: 'My Profile' }} /><Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: 'Change Password' }} /><Stack.Screen name="StatDetail" component={StatDetail} options={{ title: 'Dashboard' }} /></>}
  </Stack.Navigator></NavigationContainer>
}
export default function App() { return <SafeAreaProvider><StatusBar style="dark" /><AuthProvider><Routes /></AuthProvider></SafeAreaProvider> }
