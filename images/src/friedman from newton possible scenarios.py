import pylab
import numpy
p=2/3
x = numpy.linspace(0,200,1000) # 100 linearly spaced numbers
y1 = x ** p 
y2=x
y3= 5*numpy.sin(x/4)

# compose plot
pylab.plot(x,y1, label= r'$a=t^ \frac{2}{3}$')
pylab.plot(x,y2,'--',label= r'$a=t$ (for ref.)')
pylab.plot(x,y3,label= r'Recollapsing')
pylab.legend(loc='upper right')
pylab.ylim(0, 20)
pylab.xlim(0, 20)
pylab.ylabel(r'Scale factor $ a $')
pylab.xlabel(r'Time $t$')
pylab.savefig('fig1.png', transparent=True)
pylab.show() # show the plot