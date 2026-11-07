import Navbar from "./Components/Navbar";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./Components/Home";
import BlogDetails from "./Components/BlogDetails";
import Footer from "./Components/Footer";
import About from "./Components/About";
import Posts from "./Components/Posts";
import Categories from "./Components/Categories";
import CategoryStories from "./Components/CategoryStories";
import Contact from "./Components/Contact";
import Search from "./Components/Search";
import NotFound from "./Components/NotFound";
import Auth from "./Components/Auth";
import Admin from "./Components/Admin";
import RequireAuth from "./Components/RequireAuth";

const App = () => {
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith("/admin");

    return (
      <div className={`App${isAdminRoute ? " App-admin" : ""}`} id="top">
        {!isAdminRoute && <Navbar />}
        <div className="content">
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route path="/create" element={<RequireAuth role="admin"><Navigate to="/admin?create=1" replace /></RequireAuth>} />
            <Route path="/blogs/:id" element={<RequireAuth><BlogDetails /></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
            <Route path="/about" element={<About />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:slug" element={<CategoryStories />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/search" element={<Search />} />
            <Route path="/login" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        {!isAdminRoute && <Footer />}
      </div>
    );
};

export default App;