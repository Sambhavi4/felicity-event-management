import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import BrowseEventsPage from './pages/BrowseEventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import ClubsPage from './pages/ClubsPage';
import OrganizerDetailPage from './pages/OrganizerDetailPage';
import ProfilePage from './pages/ProfilePage';
import TicketPage from './pages/TicketPage';
import Dashboard from './pages/Dashboard';
import CreateEventPage from './pages/CreateEventPage';
import EditEventPage from './pages/EditEventPage';
import EventRegistrationsPage from './pages/EventRegistrationsPage';
import ManageOrganizersPage from './pages/ManageOrganizersPage';
import PasswordRequestsPage from './pages/PasswordRequestsPage';
import TeamManagementPage from './pages/TeamManagementPage';

const Layout = ({ children }) => (
  <>
    <Navbar />
    <main style={{ paddingTop: 20, paddingBottom: 40 }}>{children}</main>
  </>
);

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{
            style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
          }} />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route path="/events" element={<Layout><BrowseEventsPage /></Layout>} />
            <Route path="/events/:id" element={<Layout><EventDetailsPage /></Layout>} />
            <Route path="/clubs" element={<Layout><ClubsPage /></Layout>} />
            <Route path="/clubs/:id" element={<Layout><OrganizerDetailPage /></Layout>} />

            <Route path="/onboarding" element={
              <ProtectedRoute allowedRoles={['participant']}><OnboardingPage /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>
            } />
            <Route path="/ticket/:id" element={
              <ProtectedRoute allowedRoles={['participant']}><Layout><TicketPage /></Layout></ProtectedRoute>
            } />
            <Route path="/teams" element={
              <ProtectedRoute allowedRoles={['participant']}><Layout><TeamManagementPage /></Layout></ProtectedRoute>
            } />

            <Route path="/create-event" element={
              <ProtectedRoute allowedRoles={['organizer']}><Layout><CreateEventPage /></Layout></ProtectedRoute>
            } />
            <Route path="/edit-event/:id" element={
              <ProtectedRoute allowedRoles={['organizer']}><Layout><EditEventPage /></Layout></ProtectedRoute>
            } />
            <Route path="/event-registrations/:eventId" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}><Layout><EventRegistrationsPage /></Layout></ProtectedRoute>
            } />

            <Route path="/manage-organizers" element={
              <ProtectedRoute allowedRoles={['admin']}><Layout><ManageOrganizersPage /></Layout></ProtectedRoute>
            } />
            <Route path="/password-requests" element={
              <ProtectedRoute allowedRoles={['admin']}><Layout><PasswordRequestsPage /></Layout></ProtectedRoute>
            } />

            <Route path="*" element={
              <Layout>
                <div className="container text-center" style={{ paddingTop: 60 }}>
                  <h1>404</h1>
                  <p className="text-muted">Page not found</p>
                  <a href="/">Go Home</a>
                </div>
              </Layout>
            } />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
