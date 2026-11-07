const categories = [
    {
        slug: "ideas-life-growth",
        name: "Ideas · Life · Growth",
        heading: "Ideas, Stories and Insights That Matter",
        description: "A journal for curious minds, thoughtful reads, and fresh perspectives.",
        image: "/images/hero-valley.jpg",
        imageAlt: "A mountain range rising above a forested valley",
        theme: "hero-slide-dark",
    },
    {
        slug: "words-learning-perspective",
        name: "Words · Learning · Perspective",
        heading: "Good Content Builds Better Minds",
        description: "Thoughtful articles and practical ideas to inspire the way you learn and live.",
        image: "/images/hero-writing.jpg",
        imageAlt: "A fountain pen resting on a page of handwritten notes",
        theme: "hero-slide-light",
    },
    {
        slug: "tech-career-opportunity",
        name: "Tech · Career · Opportunity",
        heading: "Build Skills, Create Opportunities",
        description: "Explore useful skills, creative work, and the next steps in your journey.",
        image: "/images/hero-workspace.jpg",
        imageAlt: "A laptop and notebook on a warm wooden desk",
        theme: "hero-slide-dark",
    },
    {
        slug: "people-place-perspective",
        name: "People · Place · Perspective",
        heading: "Real Stories, A Bigger Impact",
        description: "Discover stories that connect people, open perspectives, and leave a mark.",
        image: "/images/hero-landscape.jpg",
        imageAlt: "A mountain lake surrounded by forest and alpine peaks",
        theme: "hero-slide-dark",
    },
    {
        slug: "life-learning-growth",
        name: "Life · Learning · Growth",
        heading: "Small Steps Lead to Big Dreams",
        description: "Find practical inspiration for building better habits, one day at a time.",
        image: "/images/hero-books.jpg",
        imageAlt: "Rows of books filling the shelves of a library",
        theme: "hero-slide-dark",
    },
    {
        slug: "code-design-innovation",
        name: "Code · Design · Innovation",
        heading: "Turning Ideas Into Digital Experiences",
        description: "Read about web development, design, and the ideas shaping what comes next.",
        image: "/images/hero-digital.jpg",
        imageAlt: "A laptop displaying code in a bright creative workspace",
        theme: "hero-slide-dark",
    },
];

export const featuredCategories = categories.filter((category) =>
    !["words-learning-perspective", "people-place-perspective", "life-learning-growth"].includes(category.slug)
);

export default categories;
