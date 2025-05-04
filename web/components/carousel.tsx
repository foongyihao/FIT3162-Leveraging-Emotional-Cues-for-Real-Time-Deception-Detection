import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, EffectCards, Pagination, Navigation } from 'swiper/modules'
import Image from 'next/image'
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

interface props {
}

export default function SwiperCarousel ({}: props) {
	return (
		<Swiper
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
					priority
				/>
			</SwiperSlide>
			<SwiperSlide>
				<Image 
					src={Carousel2} 
					alt="Detect Deception Carousel 2" 
					className="carousel-image"
					priority
				/>
			</SwiperSlide>
			<SwiperSlide>
				<Image 
					src={Carousel3} 
					alt="Detect Deception Carousel 3" 
					className="carousel-image"
					priority
				/>
			</SwiperSlide>
			<SwiperSlide>
				<Image 
					src={Carousel4} 
					alt="Detect Deception Carousel 4" 
					className="carousel-image"
					priority
				/>
			</SwiperSlide>
		</Swiper>
	);
}