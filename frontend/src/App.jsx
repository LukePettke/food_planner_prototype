import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Preferences from './pages/Preferences';
import MealSuggestions from './pages/MealSuggestions';
import MealSelection from './pages/MealSelection';
import Recipes from './pages/Recipes';
import ShoppingList from './pages/ShoppingList';
import Integrations from './pages/Integrations';
import Home from './pages/Home';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/plan" element={<MealSuggestions />} />
        <Route path="/select/:planId" element={<MealSelection />} />
        <Route path="/recipes/:planId" element={<Recipes />} />
        <Route path="/shopping/:planId" element={<ShoppingList />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
