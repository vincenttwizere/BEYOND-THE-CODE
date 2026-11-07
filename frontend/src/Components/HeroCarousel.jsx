import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { featuredCategories } from "../data/categories";

const slideDuration = 6500;
const slides = featuredCategories;

const HeroCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(() =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const [isFocused, setIsFocused] = useState(false);
    const isAutoplayPaused = isPaused || isFocused;

    useEffect(() => {
        if (isAutoplayPaused) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
        }, slideDuration);

        return () => window.clearTimeout(timeoutId);
    }, [activeIndex, isAutoplayPaused]);

    const showSlide = (index) => {
        setActiveIndex((currentIndex) => (currentIndex + index + slides.length) % slides.length);
    };

    const slide = slides[activeIndex];

    return (
        <section
            className="hero-carousel"
            aria-label="Featured stories"
            onFocusCapture={() => setIsFocused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsFocused(false);
                }
            }}
        >
            <div
                key={activeIndex}
                className={`hero-carousel-slide ${slide.theme}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${activeIndex + 1} of ${slides.length}`}
            >
                <img className="hero-carousel-image" src={slide.image} alt={slide.imageAlt} />
                <div className="hero-carousel-copy">
                    <p className="hero-carousel-category">{slide.name}</p>
                    <h2>{slide.heading}</h2>
                    <p className="hero-carousel-description">{slide.description}</p>
                    <a className="hero-carousel-cta" href="#all-stories">
                        Explore stories
                        <ArrowRight size={17} aria-hidden="true" />
                    </a>
                </div>
            </div>

            <div className="hero-carousel-controls">
                <div className="hero-carousel-pagination" aria-hidden="true">
                    <span>{String(activeIndex + 1).padStart(2, "0")}</span>
                    <span className="hero-carousel-pagination-total"> / {String(slides.length).padStart(2, "0")}</span>
                    <span className="hero-carousel-progress">
                        <span
                            key={activeIndex}
                            className={`hero-carousel-progress-bar${isAutoplayPaused ? " is-paused" : ""}`}
                            style={{ animationDuration: `${slideDuration}ms` }}
                        />
                    </span>
                </div>

                <div className="hero-carousel-dots" role="group" aria-label="Choose a featured story">
                    {slides.map((item, index) => (
                        <button
                            key={item.slug}
                            className={`hero-carousel-dot${index === activeIndex ? " is-active" : ""}`}
                            type="button"
                            aria-label={`Show story ${index + 1}: ${item.heading}`}
                            aria-current={index === activeIndex ? "true" : undefined}
                            onClick={() => setActiveIndex(index)}
                        />
                    ))}
                </div>

                <div className="hero-carousel-actions">
                    <button
                        className="hero-carousel-control"
                        type="button"
                        aria-label="Previous story"
                        onClick={() => showSlide(-1)}
                    >
                        <ChevronLeft size={19} aria-hidden="true" />
                    </button>
                    <button
                        className="hero-carousel-control"
                        type="button"
                        aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
                        aria-pressed={isPaused}
                        onClick={() => setIsPaused((paused) => !paused)}
                    >
                        {isPaused
                            ? <Play size={16} aria-hidden="true" />
                            : <Pause size={16} aria-hidden="true" />}
                    </button>
                    <button
                        className="hero-carousel-control"
                        type="button"
                        aria-label="Next story"
                        onClick={() => showSlide(1)}
                    >
                        <ChevronRight size={19} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default HeroCarousel;
