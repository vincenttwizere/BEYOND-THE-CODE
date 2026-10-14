import Navbar from "./Components/Navbar";
import { Routes, Route } from "react-router-dom";
import Home from "./Components/Home";
import Create from "./Components/Create";
import BlogDetails from "./Components/BlogDetails";
import Footer from "./Components/Footer";
import About from "./Components/About";
import Posts from "./Components/Posts";
import Categories from "./Components/Categories";
import CategoryStories from "./Components/CategoryStories";
import Contact from "./Components/Contact";
import Search from "./Components/Search";
import NotFound from "./Components/NotFound";

const App = () => {
  
  return (
  
      <div className="App" id="top">
        
          <Navbar />
        <div className="content">
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/blogs/:id" element={<BlogDetails />} />
            <Route path="/about" element={<About />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/categories/:slug" element={<CategoryStories />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/search" element={<Search />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </div>
  );
};

export default App;