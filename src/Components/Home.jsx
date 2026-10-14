import useFetch from "../useFetch";
import BlogList from "./Bloglist";
import HeroCarousel from "./HeroCarousel";
const Home = () => {
    const { data: blogs, isPending, error } = useFetch('http://localhost:8000/blogs');

    return (  
        <div className="home">
             <HeroCarousel />
             {isPending && (
                <div className="home-loading" role="status" aria-live="polite">
                    <span className="home-loading-spinner" aria-hidden="true" />
                    <span className="home-loading-title">Gathering stories</span>
                    <span className="home-loading-caption">A fresh read is on its way.</span>
                </div>
             )}
             {error && <div>{error}</div>}
             <div id="all-stories" className="home-blog-content">
                {blogs && <BlogList blogs={blogs} title="Latest stories" />}
             </div>
        </div>
    );
};

export default Home; 