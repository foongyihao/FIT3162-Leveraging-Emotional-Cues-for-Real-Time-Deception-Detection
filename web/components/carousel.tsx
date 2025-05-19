import React, { useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectCards, Pagination, Navigation } from 'swiper/modules';
import Image from 'next/image';
import 'swiper/css';
import 'swiper/css/effect-cards';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import '@/styles/swiper.css';

// Import carousel images
import Carousel1 from '@/assets/Carousel1.png';
import Carousel2 from '@/assets/Carousel2.png';
import Carousel3 from '@/assets/Carousel3.png';
import Carousel4 from '@/assets/Carousel4.png';

export default function SwiperCarousel() {
  const swiperRef = useRef(null);

  // Proper cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup Swiper instance when component unmounts
      if (swiperRef.current && swiperRef.current.swiper) {
        swiperRef.current.swiper.destroy(true, true);
      }
    };
  }, []);

  return (
    <Swiper
      ref={swiperRef}
      effect={'cards'}
      grabCursor={true}
      navigation={true}
      loop={false}
      modules={[Autoplay, EffectCards, Pagination, Navigation]}
      className="mySwiper"
      autoplay={{
        delay: 2500,
        disableOnInteraction: false,
      }}
    >
      <SwiperSlide>
        <Image 
          src={Carousel1} 
          alt="Detect Deception Carousel 1" 
          className="carousel-image"
          priority={true} // Only prioritize the first image
          width={800}     // Specify reasonable dimensions
          height={600}
          loading="eager" 
        />
      </SwiperSlide>
      <SwiperSlide>
        <Image 
          src={Carousel2} 
          alt="Detect Deception Carousel 2" 
          className="carousel-image"
          width={800}
          height={600}
          loading="lazy"  // Lazy load non-visible slides
        />
      </SwiperSlide>
      <SwiperSlide>
        <Image 
          src={Carousel3} 
          alt="Detect Deception Carousel 3" 
          className="carousel-image"
          width={800}
          height={600}
          loading="lazy"
        />
      </SwiperSlide>
      <SwiperSlide>
        <Image 
          src={Carousel4} 
          alt="Detect Deception Carousel 4" 
          className="carousel-image"
          width={800}
          height={600}
          loading="lazy"
        />
      </SwiperSlide>
    </Swiper>
  );
}